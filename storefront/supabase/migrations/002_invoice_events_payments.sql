-- ============================================================
-- Pim Etiket — Migration 002
--
-- (1) profiles enrichment   → fatura bilgileri (TC/VKN/firma/vergi dairesi)
--                             + e-posta doğrulanma + tercih edilen dil
-- (2) order_events          → sipariş statü timeline (immutable history)
-- (3) payments              → PSP transaction tracking + refund linki
-- ============================================================

-- ---------- 1) profiles enrichment ----------
alter table public.profiles
  add column if not exists invoice_type text
    check (invoice_type is null or invoice_type in ('individual', 'corporate')),
  add column if not exists tc text,            -- TC kimlik (11 hane)
  add column if not exists vkn text,           -- Vergi numarası (10 hane)
  add column if not exists company_name text,  -- Şirket ünvanı
  add column if not exists tax_office text,    -- Vergi dairesi
  add column if not exists invoice_format text
    check (invoice_format is null or invoice_format in ('earchive', 'einvoice')),
  add column if not exists locale text
    check (locale is null or locale in ('tr', 'en'))
    default 'tr',
  add column if not exists email_verified_at timestamptz;

-- Quick lookup için VKN üzerinde unique partial index
-- (kurumsal müşteri tek hesap kullansın)
create unique index if not exists profiles_vkn_unique
  on public.profiles(vkn)
  where vkn is not null;

-- ---------- 2) order_events ----------
-- Sipariş statü değişikliklerinin event-sourced history'si.
-- Mevcut orders.status güncel state'i tutar; her değişiklik burada kaydedilir.
-- Event-sourcing → ileride state machine refactor edersek source-of-truth
-- olur; KVKK + VUK gereği audit trail.
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  -- Event tipi → status değişimi, dosya yüklendi, prova onaylandı, vs
  event_type text not null check (event_type in (
    'created',
    'paid',
    'file_uploaded',
    'qc_passed',
    'qc_flagged',
    'operator_reviewed',
    'proof_generated',
    'proof_approved',
    'proof_rejected',
    'production_started',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
    'note_added'
  )),
  -- Bu event'ten sonra orders.status ne olmalı?
  status_after public.order_status,
  -- Event'i tetikleyen aktör — auth.users.id (müşteri/admin/sistem)
  -- null = sistem (cron, webhook)
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text check (actor_role is null or actor_role in (
    'customer',
    'admin',
    'staff',
    'system'
  )),
  -- İnsana okunabilir özet (UI timeline için)
  summary text not null,
  -- Ek detay (PSP referans no, AI flag listesi, fason atölye id, vs)
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx
  on public.order_events(order_id);
create index if not exists order_events_created_at_idx
  on public.order_events(order_id, created_at desc);

alter table public.order_events enable row level security;

-- Müşteri kendi siparişinin event'lerini görebilir
create policy "Users can view own order events"
  on public.order_events for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and o.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE sadece service_role.
-- Event-sourcing → asla update/delete edilmez (immutable);
-- yanlış event girilse bile düzeltme = yeni event ekle.

-- ---------- 3) payments ----------
-- PSP transaction tracking. Her sipariş için 1+ payment kaydı olabilir
-- (initial + refund + retry). order_id ile join, idempotent.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete restrict,
  -- PSP ne dönerse o (iyzico paymentId, ParamPOS işlemRefNo, Stripe pi_*)
  psp_provider text not null check (psp_provider in (
    'iyzico',
    'parampos',
    'stripe',
    'wallet',
    'transfer'
  )),
  psp_transaction_id text,
  -- Aksiyon tipi: 'charge' = ödeme alındı, 'refund' = iade yapıldı
  -- 'partial_refund' = kısmi iade, 'capture' = pre-auth tamamlandı
  action text not null check (action in (
    'charge',
    'refund',
    'partial_refund',
    'capture',
    'void'
  )),
  -- Tutar (₺, KDV dahil) — refund için negatif değil pozitif tutulur,
  -- action ayrımı yeter
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'TRY',
  -- 3DS, taksit, kart son 4 hane, PSP raw response
  status text not null check (status in (
    'pending',
    'success',
    'failed',
    'cancelled'
  )),
  -- Idempotency anahtarı — webhook duplicate engelleme
  idempotency_key text unique,
  -- Webhook'tan gelen ham JSON
  psp_raw jsonb default '{}'::jsonb,
  -- Maskelenmiş kart no, taksit, vs UI için
  card_masked text,
  installment integer check (installment is null or installment between 1 and 12),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payments_order_id_idx on public.payments(order_id);
create unique index if not exists payments_psp_txn_unique
  on public.payments(psp_provider, psp_transaction_id)
  where psp_transaction_id is not null;
create index if not exists payments_status_idx on public.payments(status, created_at desc);

alter table public.payments enable row level security;

-- Müşteri kendi siparişinin ödemelerini görebilir (kart son 4 hane,
-- taksit, durum) — psp_raw bu select'te yer almasın diye view ile
-- maskelenir. Şimdilik raw select tüm satıra açık.
create policy "Users can view own payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE sadece service_role (PSP webhook + admin refund).

-- ---------- Helper: sipariş yarat + event log ----------
-- Tek transaction'da: orders + order_items + ilk event ('created' + 'paid')
-- Atomik garanti, application kodu basitleşir.
create or replace function public.fn_create_order(
  p_order_id text,
  p_user_id uuid,
  p_subtotal numeric,
  p_shipping numeric,
  p_total numeric,
  p_address jsonb,
  p_invoice jsonb,
  p_payment jsonb,
  p_estimated_delivery date,
  p_items jsonb           -- array of {product, title, config, width, height, qty, unit, total, meta}
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  -- Sadece kendi adına sipariş açabilir (RLS gibi davranır)
  if auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  insert into public.orders (
    id, user_id, status, subtotal, shipping, total,
    address, invoice, payment, estimated_delivery
  ) values (
    p_order_id, p_user_id, 'paid', p_subtotal, p_shipping, p_total,
    p_address, p_invoice, p_payment, p_estimated_delivery
  );

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, product, title, config, width, height, qty, unit, total, meta
    ) values (
      p_order_id,
      item->>'product',
      item->>'title',
      item->>'config',
      (item->>'width')::integer,
      (item->>'height')::integer,
      (item->>'qty')::integer,
      (item->>'unit')::numeric,
      (item->>'total')::numeric,
      coalesce(item->'meta', '{}'::jsonb)
    );
  end loop;

  -- İlk event: oluşturuldu + ödendi
  insert into public.order_events (
    order_id, event_type, status_after, actor_id, actor_role, summary
  ) values
    (p_order_id, 'created', 'paid', p_user_id, 'customer',
     'Sipariş oluşturuldu, ödeme alındı.');

  return p_order_id;
end;
$$;

grant execute on function public.fn_create_order to authenticated;

comment on function public.fn_create_order is
  'Atomik sipariş oluşturma — orders + order_items + ilk event tek tx. Müşteri kendi adına çağırır.';
