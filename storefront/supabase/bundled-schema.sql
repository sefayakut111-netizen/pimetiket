-- ============================================================
-- Pim Etiket — Production Schema (bundled migrations 001-009)
-- 
-- Bu tek dosya 9 migration'ı sırayla içerir. Supabase Dashboard
-- → SQL Editor → New Query → bu içeriği yapıştır → Run.
-- 
-- Beklenen sonuç: "Success. No rows returned" + 16 tablo, 7 enum,
-- 4 stored function, Storage RLS policy'leri.
-- ============================================================


-- ============================================================
-- File: migrations/001_initial_schema.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Initial schema (Faz 1)
--
-- Tablolar:
--   profiles (auth.users 1:1)
--   addresses
--   cart_items
--   orders + order_items
--   wallet_transactions
--
-- Tüm tablolar RLS aktif: kullanıcı sadece kendi satırlarına
-- erişebilir. auth.uid() = user_id kuralı.
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------- addresses ----------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  name text not null,
  addr text not null,
  city text not null,
  phone text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_id_idx on public.addresses(user_id);

alter table public.addresses enable row level security;

create policy "Users can manage own addresses"
  on public.addresses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- cart_items ----------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('sticker', 'etiket')),
  title text not null,
  config text not null,
  width integer not null,
  height integer not null,
  qty integer not null check (qty > 0),
  unit numeric(10, 2) not null,
  total numeric(10, 2) not null,
  -- Sticker özel
  shape text,
  cut text check (cut is null or cut in ('tabaka', 'diecut')),
  soft_corners boolean,
  material text,
  finish text,
  hediye_adet integer,
  -- Etiket özel
  material_id text,
  coating_id text,
  customization_id text,
  winding integer,
  added_at timestamptz not null default now()
);

create index if not exists cart_items_user_id_idx on public.cart_items(user_id);

alter table public.cart_items enable row level security;

create policy "Users can manage own cart"
  on public.cart_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- orders ----------
create type public.order_status as enum (
  'paid',
  'qc_pending',
  'qc_flagged',
  'operator_review',
  'proof_pending',
  'in_production',
  'shipped',
  'delivered',
  'cancelled'
);

create table if not exists public.orders (
  -- PE-2026-XXXX formatı, app tarafında üretilir
  id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  status public.order_status not null default 'paid',
  subtotal numeric(10, 2) not null,
  shipping numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  -- JSON snapshot — checkout anında dondurulur
  address jsonb not null,
  invoice jsonb not null,
  payment jsonb not null,
  estimated_delivery date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

alter table public.orders enable row level security;

-- Müşteri sadece kendi siparişlerini görür
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Müşteri yeni sipariş oluşturabilir
create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- Müşteri durumu güncelleyemez (admin tarafı service_role ile yönetir)
-- → update policy YOK, sadece service_role yapabilir.

-- ---------- order_items ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product text not null check (product in ('sticker', 'etiket')),
  title text not null,
  config text not null,
  width integer not null,
  height integer not null,
  qty integer not null,
  unit numeric(10, 2) not null,
  total numeric(10, 2) not null,
  -- Tüm konfigürasyon snapshot'ı (cart_items mirror'u)
  meta jsonb not null default '{}'::jsonb
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.order_items enable row level security;

create policy "Users can view own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "Users can insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- ---------- wallet_transactions ----------
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Pozitif: yatırım/iade. Negatif: sipariş ödeme.
  amount numeric(10, 2) not null,
  description text not null,
  order_id text references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_user_id_idx on public.wallet_transactions(user_id);

alter table public.wallet_transactions enable row level security;

create policy "Users can view own wallet"
  on public.wallet_transactions for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE sadece service_role (admin tarafı) — müşteri direkt
-- bakiye değiştiremesin.

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- ---------- auth.users → profiles auto-create ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ============================================================
-- File: migrations/002_invoice_events_payments.sql
-- ============================================================
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
  -- Tutar (TL, KDV dahil) — refund için negatif değil pozitif tutulur,
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


-- ============================================================
-- File: migrations/003_returns_design_files.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 003
--
-- (1) returns        → İade talepleri (status: pending/approved/rejected/refunded)
-- (2) design_files   → Tasarım dosyası uploadları (versioning + AI flag'leri)
-- ============================================================

-- ---------- 1) returns ----------
create type public.return_status as enum (
  'pending',
  'approved',
  'rejected',
  'refunded'
);

create type public.return_reason as enum (
  'yanlis_urun',
  'uretim_hatasi',
  'kargo_hasari',
  'kalite_problemi',
  'diger'
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Müşteri snapshot (auth gelene kadar customer_email vardı, şimdi user_id var
  -- ama denormalize edip tutuyoruz — auth değişse bile referans kalır)
  customer_name text not null,
  customer_email text not null,
  reason public.return_reason not null,
  description text not null check (length(description) >= 20),
  -- Müşterinin yüklediği görseller — design_files veya storage path array
  -- Şimdilik path string array (Supabase Storage'da iade-photos/ bucket'ında)
  attachments text[] not null default array[]::text[],
  status public.return_status not null default 'pending',
  -- Admin notu (red mesajı, onay açıklaması)
  admin_note text,
  -- İade tutarı (TL, KDV dahil)
  refund_amount numeric(10, 2) check (refund_amount is null or refund_amount >= 0),
  -- Refund payment kaydı (varsa)
  refund_payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists returns_user_id_idx on public.returns(user_id);
create index if not exists returns_order_id_idx on public.returns(order_id);
create index if not exists returns_status_idx on public.returns(status, created_at desc);

alter table public.returns enable row level security;

create policy "Users can view own returns"
  on public.returns for select
  using (auth.uid() = user_id);

create policy "Users can create own returns"
  on public.returns for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      where o.id = returns.order_id
        and o.user_id = auth.uid()
    )
  );

-- UPDATE sadece service_role (admin onayı/reddi)

drop trigger if exists returns_updated_at on public.returns;
create trigger returns_updated_at
  before update on public.returns
  for each row
  execute function public.set_updated_at();

-- ---------- 2) design_files ----------
-- Tasarım dosyası upload tracking + versioning + AI ön-kontrol sonuçları.
-- Asıl dosya Supabase Storage'da `designs/<order_id>/<file_id>.<ext>`.
-- Bu tablo metadata + AI flag'leri tutar.
create type public.design_file_status as enum (
  'uploaded',          -- Yüklendi, AI kontrolü bekliyor
  'analyzing',         -- AI işliyor
  'qc_passed',         -- AI ön-kontrol geçti
  'qc_warned',         -- Uyarı var ama kullanılabilir
  'qc_failed',         -- Hata var, müşterinin yeniden göndermesi lazım
  'approved',          -- Operatör + müşteri prova onayladı, kilitli
  'superseded'         -- Yeni versiyon yüklendi, bu eski
);

create table if not exists public.design_files (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Order_item bağlantısı opsiyonel — bir sipariş içinde her item ayrı
  -- dosya gerekebilir; tek dosya tüm sipariş için de kullanılabilir.
  order_item_id uuid references public.order_items(id) on delete set null,
  -- Storage'daki path (designs/PE-2026-1234/<uuid>.pdf)
  storage_path text not null,
  -- Original dosya adı (müşterinin yüklediği "etiket-v3.pdf")
  original_name text not null,
  -- Boyut (byte) — limit kontrolü
  size_bytes bigint not null check (size_bytes > 0),
  -- MIME type — application/pdf, image/png, vs
  mime_type text not null,
  -- SHA-256 hash → duplicate detection + integrity
  sha256 text,
  -- Versiyon numarası (1, 2, 3 — aynı order_item_id için)
  version integer not null default 1,
  -- Status (yukarıdaki enum)
  status public.design_file_status not null default 'uploaded',
  -- AI ön-kontrol sonuçları (DPI, CMYK, bleed, safe zone)
  -- Format: { dpi: 320, cmyk: true, bleed_mm: 2, safe_zone_ok: true,
  --          flags: [{kind: 'ok'|'warning'|'error', message: '...'}] }
  ai_check jsonb default '{}'::jsonb,
  -- Operatör notu (manuel inceleme sonucu)
  operator_note text,
  -- Onaylandığı tarih (kilit zamanı)
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_files_order_id_idx
  on public.design_files(order_id);
create index if not exists design_files_user_id_idx
  on public.design_files(user_id);
create index if not exists design_files_status_idx
  on public.design_files(status, uploaded_at desc);
-- Aynı order_item için aktif (superseded olmayan) tek versiyon var
create unique index if not exists design_files_active_version
  on public.design_files(order_id, order_item_id, version)
  where order_item_id is not null;

alter table public.design_files enable row level security;

create policy "Users can view own design files"
  on public.design_files for select
  using (auth.uid() = user_id);

create policy "Users can upload own design files"
  on public.design_files for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      where o.id = design_files.order_id
        and o.user_id = auth.uid()
    )
  );

-- Müşteri SADECE 'uploaded' status'undeki dosyayı silebilir (yeniden yükleme)
-- 'qc_*' veya sonrası → admin müdahale lazım
create policy "Users can delete own pending uploads"
  on public.design_files for delete
  using (
    auth.uid() = user_id
    and status in ('uploaded', 'qc_failed')
  );

drop trigger if exists design_files_updated_at on public.design_files;
create trigger design_files_updated_at
  before update on public.design_files
  for each row
  execute function public.set_updated_at();

-- Helper: yeni versiyon yüklendiğinde eskiyi 'superseded' yap
create or replace function public.fn_supersede_old_versions()
returns trigger
language plpgsql
as $$
begin
  if new.order_item_id is not null then
    update public.design_files
      set status = 'superseded'
      where order_id = new.order_id
        and order_item_id = new.order_item_id
        and id <> new.id
        and version < new.version
        and status not in ('approved', 'superseded');
  end if;
  return new;
end;
$$;

drop trigger if exists design_files_supersede on public.design_files;
create trigger design_files_supersede
  after insert on public.design_files
  for each row
  execute function public.fn_supersede_old_versions();


-- ============================================================
-- File: migrations/004_notifications_audit.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 004
--
-- (1) notification_prefs  → Kullanıcı email + SMS opt-in tercihleri
-- (2) audit_log           → Admin işlemleri için immutable audit trail
--                           (KVKK + VUK — kim ne zaman ne yaptı)
-- ============================================================

-- ---------- 1) notification_prefs ----------
-- Tek satır per user. /bildirim-tercihleri sayfası bunu yönetir.
-- Mail/SMS gönderim öncesi server bu tabloyu sorgular.
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Email kategorileri
  email_order_updates boolean not null default true,    -- ZORUNLU (yasal)
  email_proof_ready boolean not null default true,
  email_shipping_updates boolean not null default true,
  email_marketing boolean not null default false,       -- KVKK opt-in
  email_blog boolean not null default false,            -- KVKK opt-in
  -- SMS kategorileri
  sms_urgent_order boolean not null default true,
  sms_proof_ready boolean not null default false,
  sms_delivery boolean not null default false,
  -- Onay tarihleri (KVKK kanıtı)
  marketing_consent_at timestamptz,
  blog_consent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

create policy "Users can view own prefs"
  on public.notification_prefs for select
  using (auth.uid() = user_id);

create policy "Users can update own prefs"
  on public.notification_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own prefs"
  on public.notification_prefs for insert
  with check (auth.uid() = user_id);

drop trigger if exists notification_prefs_updated_at on public.notification_prefs;
create trigger notification_prefs_updated_at
  before update on public.notification_prefs
  for each row
  execute function public.set_updated_at();

-- Yeni kullanıcı → default prefs satırı otomatik aç
create or replace function public.handle_new_user_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_prefs on auth.users;
create trigger on_auth_user_created_prefs
  after insert on auth.users
  for each row
  execute function public.handle_new_user_prefs();

-- ---------- 2) audit_log ----------
-- Admin işlemleri immutable log. Append-only.
-- Mevcut localStorage audit-log.ts'in DB karşılığı.
create type public.audit_action as enum (
  'order.status_change',
  'order.cancel',
  'order.refund',
  'return.approve',
  'return.reject',
  'return.refund',
  'coupon.create',
  'coupon.update',
  'coupon.delete',
  'review.approve',
  'review.reject',
  'review.delete',
  'staff.invite',
  'staff.remove',
  'staff.role_change',
  'settings.update',
  'design_file.approve',
  'design_file.reject',
  'auth.login',
  'auth.logout',
  'profile.delete'
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Eylemi yapan (auth.users.id)
  actor_id uuid references auth.users(id) on delete set null,
  -- Denormalize fields — actor profil silinse de audit kalır
  actor_email text,
  actor_role text check (actor_role is null or actor_role in (
    'customer', 'admin', 'staff', 'system'
  )),
  action public.audit_action not null,
  -- Etkilenen entity (order id, return id, coupon id, vs)
  target_type text,
  target_id text,
  -- İnsana okunabilir özet (UI listesi için)
  summary text not null,
  -- Ek detay (eski-yeni değer, IP, user-agent, vs)
  detail jsonb default '{}'::jsonb,
  -- İstemci IP — request header'dan alınır
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx
  on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_target_idx
  on public.audit_log(target_type, target_id);
create index if not exists audit_log_action_idx
  on public.audit_log(action, created_at desc);
create index if not exists audit_log_created_at_idx
  on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Müşteri SADECE kendi profil/sipariş/iade ile ilgili audit'leri görebilir
-- (auth.login, auth.logout, profile.delete, kendi siparişinde değişiklik)
create policy "Users can view own audit entries"
  on public.audit_log for select
  using (auth.uid() = actor_id);

-- INSERT sadece service_role (uygulama admin işlemlerinde server-side log atar)
-- UPDATE/DELETE → ASLA. Append-only.

-- Bypass denemesi için bonus: NO ROW LEVEL constraint trigger
-- (immutable enforce — service_role bile UPDATE/DELETE yapamaz, sadece SUPERUSER)
create or replace function public.fn_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.fn_audit_log_immutable();

drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.fn_audit_log_immutable();

-- Helper: client-side'dan kolayca log atmak için RPC
-- (sadece authenticated, kendi adına aksiyonları için)
create or replace function public.fn_log_audit(
  p_action public.audit_action,
  p_target_type text default null,
  p_target_id text default null,
  p_summary text default '',
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  -- Müşteri sadece auth.* + profile.delete + kendi sipariş/iadesini logla
  if p_action not in (
    'auth.login', 'auth.logout', 'profile.delete'
  ) then
    raise exception 'this action requires admin role (use service_role)';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.audit_log (
    actor_id, actor_email, actor_role,
    action, target_type, target_id, summary, detail
  ) values (
    auth.uid(), v_email, 'customer',
    p_action, p_target_type, p_target_id, p_summary, p_detail
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.fn_log_audit to authenticated;

comment on function public.fn_log_audit is
  'Müşterinin kendi adına audit log atması için RPC. Sadece auth.* ve profile.delete eylemleri.';


-- ============================================================
-- File: migrations/005_coupons_reviews.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 005
--
-- (1) coupons       → Kupon kodları (admin oluşturur, müşteri /odeme'de uygular)
-- (2) coupon_uses   → Kullanım kayıtları (limit + müşteri başına 1 kez kontrolü)
-- (3) reviews       → Müşteri yorumları (admin moderation queue'lu)
-- ============================================================

-- ---------- 1) coupons ----------
create type public.coupon_kind as enum (
  'percent',     -- %X indirim (max ile sınırlı olabilir)
  'fixed',       -- Sabit X TL indirim
  'free_ship'    -- Kargo ücretsiz
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Tek tip kod, case-insensitive (UPPER ile saklanır)
  code text not null unique,
  kind public.coupon_kind not null,
  -- percent → 0-100 arası (5 = %5)
  -- fixed   → TL miktarı (50 = 50 TL)
  -- free_ship → 0 (yalnız bayrak)
  value numeric(10, 2) not null check (value >= 0),
  -- percent kuponu için max indirim TL — null = sınırsız
  max_discount numeric(10, 2),
  -- Min sepet tutarı — bu altındaysa kupon uygulanmaz
  min_subtotal numeric(10, 2) not null default 0,
  -- Toplam kullanım limiti — null = sınırsız
  total_uses_limit integer check (total_uses_limit is null or total_uses_limit > 0),
  -- Bir müşteri kaç kez kullanabilir — null = sınırsız
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  -- Geçerlilik aralığı
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  -- Admin notu (UI'da gösterilmez, dashboard için)
  description text,
  -- Aktif mi (silmek yerine deactivate)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists coupons_code_idx on public.coupons(code);
create index if not exists coupons_active_idx on public.coupons(is_active, expires_at);

alter table public.coupons enable row level security;

-- Müşteri SADECE kod doğrulama için lookup yapabilir (kod biliniyorsa
-- bu kupon var mı diye). Direkt SELECT açık tutmak yerine RPC kullandır.
-- Yine de read-only access verelim ki admin paneli kolay listelesin
-- (admin auth'undaki staff için service_role gibi davranır).
create policy "Anyone can lookup active coupons by code"
  on public.coupons for select
  using (is_active = true and (expires_at is null or expires_at > now()));

-- INSERT/UPDATE/DELETE sadece service_role (admin tarafı).

drop trigger if exists coupons_updated_at on public.coupons;
create trigger coupons_updated_at
  before update on public.coupons
  for each row
  execute function public.set_updated_at();

-- code'u UPPER ile sakla — case-insensitive lookup
create or replace function public.fn_coupons_normalize_code()
returns trigger
language plpgsql
as $$
begin
  new.code = upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists coupons_normalize on public.coupons;
create trigger coupons_normalize
  before insert or update on public.coupons
  for each row
  execute function public.fn_coupons_normalize_code();

-- ---------- 2) coupon_uses ----------
create table if not exists public.coupon_uses (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null references public.orders(id) on delete cascade,
  -- O sipariş için bu kuponla ne kadar düşürüldü
  discount_amount numeric(10, 2) not null check (discount_amount >= 0),
  used_at timestamptz not null default now(),
  -- Bir sipariş başına 1 kupon kuralı
  unique (order_id)
);

create index if not exists coupon_uses_coupon_idx on public.coupon_uses(coupon_id);
create index if not exists coupon_uses_user_idx on public.coupon_uses(user_id);

alter table public.coupon_uses enable row level security;

create policy "Users can view own coupon uses"
  on public.coupon_uses for select
  using (auth.uid() = user_id);

-- INSERT sadece service_role (atomik kontrol fn_apply_coupon ile yapılır)

-- Helper: kuponu uygula. Atomik kontrol + insert.
create or replace function public.fn_apply_coupon(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid,
  p_order_id text
)
returns jsonb       -- { ok: bool, discount: number, reason?: string }
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_total_used integer;
  v_user_used integer;
  v_discount numeric(10, 2);
begin
  -- Sadece kendi siparişin için
  if auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  -- Kuponu bul
  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now();

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  -- Min subtotal kontrolü
  if p_subtotal < v_coupon.min_subtotal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_subtotal',
      'min_subtotal', v_coupon.min_subtotal
    );
  end if;

  -- Toplam kullanım limiti
  if v_coupon.total_uses_limit is not null then
    select count(*) into v_total_used
      from public.coupon_uses where coupon_id = v_coupon.id;
    if v_total_used >= v_coupon.total_uses_limit then
      return jsonb_build_object('ok', false, 'reason', 'total_limit_reached');
    end if;
  end if;

  -- Per-user kullanım limiti
  if v_coupon.per_user_limit is not null then
    select count(*) into v_user_used
      from public.coupon_uses
      where coupon_id = v_coupon.id and user_id = p_user_id;
    if v_user_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'reason', 'user_limit_reached');
    end if;
  end if;

  -- İndirim hesabı
  if v_coupon.kind = 'percent' then
    v_discount := round(p_subtotal * v_coupon.value / 100, 2);
    if v_coupon.max_discount is not null and v_discount > v_coupon.max_discount then
      v_discount := v_coupon.max_discount;
    end if;
  elsif v_coupon.kind = 'fixed' then
    v_discount := least(v_coupon.value, p_subtotal);
  else  -- free_ship → indirim 0, kargo ayrı düşülür
    v_discount := 0;
  end if;

  -- Kullanım kaydı
  insert into public.coupon_uses (coupon_id, user_id, order_id, discount_amount)
  values (v_coupon.id, p_user_id, p_order_id, v_discount);

  return jsonb_build_object(
    'ok', true,
    'discount', v_discount,
    'kind', v_coupon.kind,
    'coupon_id', v_coupon.id
  );
end;
$$;

grant execute on function public.fn_apply_coupon to authenticated;

comment on function public.fn_apply_coupon is
  'Sipariş oluşturma esnasında kupon uygulama. Atomik kontrol + insert. JSON döner.';

-- Helper: sadece kontrol et (uygulama YAPMA) — UI'da "geçerli mi?" preview
create or replace function public.fn_validate_coupon(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_user_id uuid := auth.uid();
  v_user_used integer;
  v_discount numeric(10, 2);
begin
  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now();

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  if p_subtotal < v_coupon.min_subtotal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_subtotal',
      'min_subtotal', v_coupon.min_subtotal
    );
  end if;

  if v_user_id is not null and v_coupon.per_user_limit is not null then
    select count(*) into v_user_used
      from public.coupon_uses
      where coupon_id = v_coupon.id and user_id = v_user_id;
    if v_user_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'reason', 'user_limit_reached');
    end if;
  end if;

  if v_coupon.kind = 'percent' then
    v_discount := round(p_subtotal * v_coupon.value / 100, 2);
    if v_coupon.max_discount is not null and v_discount > v_coupon.max_discount then
      v_discount := v_coupon.max_discount;
    end if;
  elsif v_coupon.kind = 'fixed' then
    v_discount := least(v_coupon.value, p_subtotal);
  else
    v_discount := 0;
  end if;

  return jsonb_build_object(
    'ok', true,
    'discount', v_discount,
    'kind', v_coupon.kind
  );
end;
$$;

grant execute on function public.fn_validate_coupon to anon, authenticated;

-- ---------- 3) reviews ----------
create type public.review_status as enum (
  'pending',     -- Moderation bekliyor
  'published',   -- Yayında
  'rejected',    -- Reddedildi
  'hidden'       -- Yayından kaldırıldı (admin)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Hangi siparişle ilgili (1 sipariş = 1 yorum kuralı)
  order_id text not null references public.orders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null check (length(body) >= 10 and length(body) <= 2000),
  -- Tüketici öne çıkanlar / şikayetler
  pros text,
  cons text,
  status public.review_status not null default 'pending',
  -- Admin moderation notu
  moderation_note text,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  -- Helpful counter (gelecekte upvote)
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Bir sipariş için tek yorum
  unique (user_id, order_id)
);

create index if not exists reviews_status_idx
  on public.reviews(status, created_at desc);
create index if not exists reviews_rating_idx on public.reviews(rating);

alter table public.reviews enable row level security;

-- Yayında olan yorumları herkes görebilir (galeri/anasayfa)
create policy "Anyone can view published reviews"
  on public.reviews for select
  using (status = 'published');

-- Müşteri kendi yorumunu (her status'ta) görür
create policy "Users can view own reviews"
  on public.reviews for select
  using (auth.uid() = user_id);

-- Müşteri yorum yazabilir (sadece kendi delivered siparişine)
create policy "Users can create review on delivered order"
  on public.reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.user_id = auth.uid()
        and o.status = 'delivered'
    )
  );

-- Müşteri kendi pending yorumunu silebilir (henüz yayına çıkmadan)
create policy "Users can delete own pending review"
  on public.reviews for delete
  using (auth.uid() = user_id and status = 'pending');

-- UPDATE sadece service_role (moderation)

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();


-- ============================================================
-- File: migrations/006_storage_buckets.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 006
--
-- Supabase Storage bucket'ları + RLS politikaları.
--
-- Bucket'lar:
--   designs       → Müşteri tasarım dosyaları (PDF, AI, EPS, PSD, PNG, JPG, SVG)
--                   Path pattern: designs/<order_id>/<file_uuid>.<ext>
--                   Müşteri sadece kendi sipariş klasörüne yazabilir.
--   return-photos → İade talebi görselleri (sadece JPG/PNG)
--                   Path pattern: return-photos/<return_id>/<photo_uuid>.<ext>
--   reviews-photos → Yorum görselleri (gelecek faz, opsiyonel)
--   public-assets → Footer/blog/banner görselleri (admin yükler, public okur)
--
-- NOT: Storage bucket'ları SQL ile değil Supabase Dashboard'dan veya
-- Storage API ile oluşturulur. Bu migration sadece RLS politikalarını
-- yazar. Bucket'lar manuel oluşturulduktan sonra policy'ler aktif olur.
--
-- Bucket OLUŞTURMA — Supabase Dashboard:
--   Storage → New bucket → public off → file size limit 30 MB →
--   allowed mime types: application/pdf, image/png, image/jpeg, image/svg+xml,
--   application/illustrator, application/postscript, image/vnd.adobe.photoshop
-- ============================================================

-- storage.objects tablosunda RLS zaten enabled (Supabase default).
-- Sadece policy'leri ekliyoruz.

-- ---------- designs bucket ----------
-- INSERT: Müşteri sadece kendi siparişine yükleyebilir
-- Path: designs/<order_id>/<file>
-- Kontrol: order_id müşteriye ait mi?
drop policy if exists "Users can upload to own orders" on storage.objects;
create policy "Users can upload to own orders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] in (
      select id from public.orders where user_id = auth.uid()
    )
  );

-- SELECT: Müşteri sadece kendi tasarım dosyalarını okuyabilir
drop policy if exists "Users can read own designs" on storage.objects;
create policy "Users can read own designs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] in (
      select id from public.orders where user_id = auth.uid()
    )
  );

-- DELETE: Müşteri sadece pending status'undeki dosyayı silebilir
-- (design_files.status kontrolü)
drop policy if exists "Users can delete own pending designs" on storage.objects;
create policy "Users can delete own pending designs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'designs'
    and exists (
      select 1 from public.design_files df
      where df.storage_path = name
        and df.user_id = auth.uid()
        and df.status in ('uploaded', 'qc_failed')
    )
  );

-- ---------- return-photos bucket ----------
drop policy if exists "Users can upload return photos" on storage.objects;
create policy "Users can upload return photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.returns where user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own return photos" on storage.objects;
create policy "Users can read own return photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.returns where user_id = auth.uid()
    )
  );

-- ---------- public-assets bucket ----------
-- Admin yükler (service_role), herkes okur
drop policy if exists "Anyone can read public assets" on storage.objects;
create policy "Anyone can read public assets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public-assets');

-- INSERT/UPDATE/DELETE sadece service_role (admin)


-- ============================================================
-- File: migrations/007_payment_intents.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 007
--
-- payment_intents: ödeme öncesi geçici state.
-- /odeme submit'te oluşur, iyzico callback'inde kullanılır,
-- sipariş açıldıktan sonra status='consumed' olarak işaretlenir.
--
-- AKIŞ:
--   1. /api/payment/init → INSERT (status=pending, snapshot=cart+address+invoice)
--   2. iyzico CheckoutForm → user 3DS yapar
--   3. iyzico callback → /api/payment/callback POST
--   4. Server: SELECT intent by conversationId → fn_create_order →
--      UPDATE intent (status=consumed, order_id)
--      INSERT payments (status=success)
--
-- Eski intent'ler (>24 saat) cron ile temizlenebilir (status=pending,
-- created_at < now() - 24h).
-- ============================================================

create type public.payment_intent_status as enum (
  'pending',     -- /odeme/init oluşturdu, henüz ödenmedi
  'consumed',    -- callback'te kullanıldı, sipariş açıldı
  'failed',      -- iyzico fail döndü
  'expired'      -- 24h'tan eski, cron temizledi
);

create table if not exists public.payment_intents (
  -- conversationId — iyzico'ya gönderdiğimiz unique id
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- iyzico token (CheckoutForm Initialize'den dönen)
  iyzico_token text,
  -- Tutar (TL, KDV dahil) — iyzico'da bu kadar tahsil edilecek
  card_amount numeric(10, 2) not null check (card_amount >= 0),
  wallet_amount numeric(10, 2) not null default 0 check (wallet_amount >= 0),
  total_amount numeric(10, 2) generated always as (card_amount + wallet_amount) stored,
  -- Sipariş bilgileri snapshot (cart + address + invoice + shipping)
  -- callback'te fn_create_order çağrısında bu kullanılır
  snapshot jsonb not null,
  status public.payment_intent_status not null default 'pending',
  -- Sipariş açıldıktan sonra bağlanır
  order_id text references public.orders(id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists payment_intents_user_idx
  on public.payment_intents(user_id, created_at desc);
create index if not exists payment_intents_status_idx
  on public.payment_intents(status, created_at desc);
create index if not exists payment_intents_token_idx
  on public.payment_intents(iyzico_token)
  where iyzico_token is not null;

alter table public.payment_intents enable row level security;

-- Müşteri sadece kendi intent'lerini görür
create policy "Users can view own payment intents"
  on public.payment_intents for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE sadece service_role (route handler).
-- Müşteri direkt intent oluşturamaz — /api/payment/init endpoint'inden
-- geçer (validation + auth + iyzico call).

-- Helper: intent consume — fn_create_order'ı atomik çağırır
create or replace function public.fn_consume_payment_intent(
  p_intent_id text,
  p_order_id text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
begin
  select * into v_intent
    from public.payment_intents
    where id = p_intent_id
      and user_id = p_user_id
      and status = 'pending'
    for update;

  if not found then
    raise exception 'intent_not_found_or_already_consumed';
  end if;

  update public.payment_intents
    set status = 'consumed',
        order_id = p_order_id,
        consumed_at = now()
    where id = p_intent_id;

  return true;
end;
$$;

-- service_role + authenticated execute (callback handler service_role
-- kullanır; admin de çağırabilsin)
grant execute on function public.fn_consume_payment_intent
  to service_role;

comment on table public.payment_intents is
  'Ödeme intent staging — /api/payment/init INSERT, callback CONSUME, fn_create_order çağrısında snapshot kullanılır.';

comment on function public.fn_consume_payment_intent is
  'Intent consume + sipariş ID bağla. SELECT FOR UPDATE ile race-safe.';


-- ============================================================
-- File: migrations/008_design_temp_uploads.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 008
--
-- Pre-purchase tasarım yükleme — müşteri konfigüre ederken sepete
-- eklemeden önce tasarım yükleyebilir, canlı mockup'ta görür.
--
-- Akış:
--   1. /sticker veya /etiket'te DesignDropZone'a dosya at
--   2. /api/design/temp-upload-init → signed URL (storage path:
--      temp/<userId>/<uuid>.<ext>)
--   3. Browser → Supabase Storage upload
--   4. /api/design/temp-upload-complete → design_temp_uploads INSERT
--   5. Cart item insert'inde design_temp_id reference tutulur
--   6. /api/payment/callback'te success'te → temp file rename edilir
--      (designs/<orderId>/<uuid>.<ext>) + design_files row açılır
--      (status=uploaded, AI check başlar)
--
-- Cleanup: 24 saat sonra promoted_to NULL olan temp upload'lar
-- silinir (cron + storage delete).
-- ============================================================

create table if not exists public.design_temp_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Storage path: temp/<userId>/<uuid>.<ext>
  storage_path text not null,
  original_name text not null,
  size_bytes bigint not null check (size_bytes > 0),
  mime_type text not null,
  sha256 text,
  -- Sipariş açıldıktan sonra design_files row'ına link
  promoted_to uuid references public.design_files(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
    default (now() + interval '24 hours')
);

create index if not exists design_temp_uploads_user_idx
  on public.design_temp_uploads(user_id, created_at desc);
create index if not exists design_temp_uploads_expires_idx
  on public.design_temp_uploads(expires_at)
  where promoted_to is null;
create index if not exists design_temp_uploads_path_idx
  on public.design_temp_uploads(storage_path);

alter table public.design_temp_uploads enable row level security;

-- Müşteri sadece kendi temp upload'larını görür
create policy "Users can view own temp uploads"
  on public.design_temp_uploads for select
  using (auth.uid() = user_id);

create policy "Users can create own temp uploads"
  on public.design_temp_uploads for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own pending temp uploads"
  on public.design_temp_uploads for delete
  using (auth.uid() = user_id and promoted_to is null);

-- ---------- cart_items: design_temp_id ekle ----------
-- Müşteri sticker/etiket konfigüre ederken yüklediği tasarımı bu cart
-- item'a bağlar. Order create'te promote edilir.
alter table public.cart_items
  add column if not exists design_temp_id uuid
    references public.design_temp_uploads(id) on delete set null;

create index if not exists cart_items_design_temp_idx
  on public.cart_items(design_temp_id)
  where design_temp_id is not null;

-- ---------- Storage RLS update — temp/ path support ----------
-- Mevcut policy (mig 006): kullanıcı sadece designs/<orderId>/<file>
-- pattern'ına yazabilir. Şimdi ek pattern: designs/temp/<userId>/<file>
-- (orderId yerine "temp" prefix + user klasörü).

-- INSERT: temp pattern için ayrı policy
drop policy if exists "Users can upload to own temp folder" on storage.objects;
create policy "Users can upload to own temp folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = 'temp'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- SELECT: kullanıcı kendi temp klasörünü okuyabilir
drop policy if exists "Users can read own temp uploads" on storage.objects;
create policy "Users can read own temp uploads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = 'temp'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- DELETE: temp dosyayı kullanıcı silebilir (replace senaryosu)
drop policy if exists "Users can delete own temp uploads" on storage.objects;
create policy "Users can delete own temp uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = 'temp'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------- Cleanup helper (cron job için) ----------
-- 24 saat sonra promote edilmemiş temp upload'ları temizle.
-- Sefa pg_cron extension açtıktan sonra şu şekilde çağrılabilir:
--   select cron.schedule('cleanup-temp-designs', '0 3 * * *',
--     'select public.fn_cleanup_temp_designs()');
create or replace function public.fn_cleanup_temp_designs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_path text;
begin
  -- Storage cleanup uygulama tarafında yapılır (storage admin client gerekir).
  -- Burada sadece DB row'larını siliyoruz.
  -- TODO: Edge function veya cron worker'dan storage.deleteObject çağrı.
  for v_path in
    select storage_path from public.design_temp_uploads
    where promoted_to is null
      and expires_at < now()
  loop
    -- Storage'dan temizleme uygulama yapacak (NOTIFY veya cron)
    null;
  end loop;

  delete from public.design_temp_uploads
    where promoted_to is null
      and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on table public.design_temp_uploads is
  'Pre-purchase tasarım upload staging — sepete eklemeden önce yüklenen dosyalar. 24h TTL, sipariş açılınca design_files row''a promote edilir.';


-- ============================================================
-- File: migrations/009_paytr_provider.sql
-- ============================================================
-- ============================================================
-- Pim Etiket — Migration 009
--
-- payments.psp_provider check constraint'ine 'paytr' eklendi.
-- Sefa karar verdi: iyzico yerine PayTR kullanılacak (komisyon
-- avantajı). Eski 'iyzico' değeri tarihsel kayıtlar için
-- (varsa) korundu.
-- ============================================================

alter table public.payments
  drop constraint if exists payments_psp_provider_check;

alter table public.payments
  add constraint payments_psp_provider_check
  check (psp_provider in (
    'paytr',
    'iyzico',     -- legacy, eski test kayıtları için
    'parampos',
    'stripe',
    'wallet',
    'transfer'
  ));

comment on column public.payments.psp_provider is
  'Ödeme sağlayıcı. Aktif: paytr. Diğerleri legacy/future-proof.';

