-- ============================================================
-- Pim Etiket — Migration 059: Müşteri Baskı Onay (Proof Approval) Akışı
--
-- Sefa 19 May v68:
-- Sipariş verildikten sonra "baskı onay sayfası" akışı:
--   1. paid → proof_pending (mevcut enum, müşteri onay sayfasına yönlendirilir)
--   2. Müşteri her order_item'a tek tek onay verir veya bıçağı düzenler
--   3. Tüm itemler approved olunca orders.status = 'proof_approved' (YENİ enum)
--   4. operator_review veya in_production'a geçiş
--
-- Bu migration:
--   1. order_status enum'a 'proof_approved' ekler
--   2. order_items'e per-item proof_status + view_at + approved_at + cutline ref
--   3. cutline_designs tablosu (POC'un üretmiş olduğu SVG'lerin kaydı)
--   4. proof_help_requests tablosu (müşteri "yardım iste" ticket'ı)
--   5. RPC fn_finalize_proof — tüm itemler approved mı kontrol et + state geç
--   6. RPC fn_proof_summary — sayfa load için tek sorguda özet
-- ============================================================

-- ============================================================
-- 1) ORDER_STATUS ENUM'A 'proof_approved' EKLE
-- ============================================================
-- Sefa kuralı: enum değişiklikleri her zaman idempotent (Migration 039 ile aynı pattern)
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'proof_approved'
      and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'proof_approved' after 'proof_pending';
  end if;
end $$;

-- ============================================================
-- 2) ORDER_ITEMS'E PROOF KOLONLARI
-- ============================================================
-- proof_status — per-item müşteri onay durumu
--   pending: müşteri henüz incelememiş
--   viewed: müşteri açtı ama karar vermedi
--   approved: müşteri onayladı
--   editing: müşteri bıçak düzenliyor (kalıcı state)
--   edited: müşteri kaydetti, tekrar onay bekleniyor
--   help_requested: müşteri operatör yardımı istedi (sayaç durur)
alter table public.order_items
  add column if not exists proof_status text not null default 'pending'
    check (proof_status in ('pending','viewed','approved','editing','edited','help_requested')),
  add column if not exists proof_viewed_at timestamptz,
  add column if not exists proof_approved_at timestamptz,
  add column if not exists proof_edited_at timestamptz,
  add column if not exists cutline_design_id uuid;

-- Index: tüm onaylanmamış itemleri hızlı bulmak için (cron + reminder)
create index if not exists order_items_proof_status_idx
  on public.order_items(order_id, proof_status);

-- ============================================================
-- 3) CUTLINE_DESIGNS — POC artifactları
-- ============================================================
-- Sefa'nın POC'u (pim_etiket_poc.html) müşteri onayında SVG üretiyor.
-- Onay/Düzenleme sırasında üretilen her SVG burada kalıcı saklanır.
-- svg_url R2'deki gerçek dosyaya işaret eder (customer-cutlines/...).
create table if not exists public.cutline_designs (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  user_id uuid references auth.users(id),

  -- Storage referansı
  svg_url text not null,                  -- R2 key: customer-cutlines/{order}/{item}/{ts}.svg
  preview_png_url text,                   -- Opsiyonel canvas snapshot

  -- POC metadata
  source text not null
    check (source in ('raster','vector','vector-with-cutline','psd','operator-override')),
  mode text not null
    check (mode in ('contour','hull','rect','circle','operator')),
  offset_mm numeric(4,2),
  smoothness integer,
  dpi integer,
  width_mm numeric(8,2),
  height_mm numeric(8,2),

  -- Pim AI yorumu (POC'ta kural-tabanlı, prod'da Claude/OpenAI)
  pim_feedback text,
  pim_severity text check (pim_severity in ('ok','warn','err')),

  -- Lifecycle
  status text not null default 'draft'
    check (status in ('draft','approved','operator_override','superseded')),
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cutline_designs_order_id_idx
  on public.cutline_designs(order_id);
create index if not exists cutline_designs_item_id_idx
  on public.cutline_designs(order_item_id);
create index if not exists cutline_designs_status_idx
  on public.cutline_designs(status)
  where status = 'draft';

alter table public.cutline_designs enable row level security;

-- Müşteri kendi siparişinin cutline'larını okur
create policy if not exists cutline_designs_owner_select
  on public.cutline_designs for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.id = cutline_designs.order_id
        and o.user_id = auth.uid()
    )
  );

-- Müşteri kendi siparişine cutline INSERT edebilir (sadece kendi user_id ile)
create policy if not exists cutline_designs_owner_insert
  on public.cutline_designs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = cutline_designs.order_id
        and o.user_id = auth.uid()
        and o.status in ('proof_pending')
    )
  );

-- Müşteri kendi draft cutline'ını günceller
create policy if not exists cutline_designs_owner_update
  on public.cutline_designs for update
  using (
    user_id = auth.uid()
    and status = 'draft'
  );

-- ============================================================
-- 4) PROOF_HELP_REQUESTS — Müşteri "Yardım iste" ticket'ı
-- ============================================================
-- POC'taki modal "Ekibimizden yardım iste" → operatör paneline düşer.
-- order_items.proof_status='help_requested' iken bu satır AÇIK olmalı.
create table if not exists public.proof_help_requests (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  user_id uuid not null references auth.users(id),

  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','dismissed')),

  -- Operatör çözüm bilgisi
  resolved_by uuid references auth.users(id),
  resolution_note text,
  resolution_cutline_id uuid references public.cutline_designs(id),

  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists proof_help_requests_status_idx
  on public.proof_help_requests(status, created_at desc)
  where status in ('open','in_progress');
create index if not exists proof_help_requests_user_idx
  on public.proof_help_requests(user_id, created_at desc);

alter table public.proof_help_requests enable row level security;

-- Müşteri sadece kendi ticket'larını görür
create policy if not exists proof_help_requests_owner_select
  on public.proof_help_requests for select
  using (user_id = auth.uid());

-- Müşteri kendi siparişine ticket açar
create policy if not exists proof_help_requests_owner_insert
  on public.proof_help_requests for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = proof_help_requests.order_id
        and o.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5) RPC: fn_proof_summary — sayfa load için tek sorguda özet
-- ============================================================
-- /onay/[orderId] sayfası açılınca tek call ile her şeyi alır:
--   - Sipariş bilgisi (status, total, address özeti)
--   - Her item için: title, qty, config, design_url (orijinal), cutline (son draft veya approved)
--   - Genel ilerleme: total / approved / pending
create or replace function public.fn_proof_summary(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_row record;
  v_items_json jsonb;
  v_uid uuid := auth.uid();
begin
  -- Yetki kontrolü: sadece sipariş sahibi
  select * into v_order_row from public.orders
   where id = p_order_id;
  if v_order_row is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_order_row.user_id <> v_uid then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- Items + son cutline draft'larını topla
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product', oi.product,
        'title', oi.title,
        'config', oi.config,
        'width', oi.width,
        'height', oi.height,
        'qty', oi.qty,
        'unit', oi.unit,
        'total', oi.total,
        'meta', oi.meta,
        'proof_status', oi.proof_status,
        'proof_viewed_at', oi.proof_viewed_at,
        'proof_approved_at', oi.proof_approved_at,
        'cutline', (
          select jsonb_build_object(
            'id', cd.id,
            'svg_url', cd.svg_url,
            'preview_png_url', cd.preview_png_url,
            'source', cd.source,
            'mode', cd.mode,
            'offset_mm', cd.offset_mm,
            'dpi', cd.dpi,
            'width_mm', cd.width_mm,
            'height_mm', cd.height_mm,
            'pim_feedback', cd.pim_feedback,
            'pim_severity', cd.pim_severity,
            'status', cd.status
          )
          from public.cutline_designs cd
          where cd.order_item_id = oi.id
          order by cd.created_at desc
          limit 1
        ),
        'help_request', (
          select jsonb_build_object(
            'id', phr.id,
            'message', phr.message,
            'status', phr.status,
            'created_at', phr.created_at,
            'resolution_note', phr.resolution_note
          )
          from public.proof_help_requests phr
          where phr.order_item_id = oi.id
            and phr.status in ('open','in_progress')
          order by phr.created_at desc
          limit 1
        )
      )
      order by oi.id
    ),
    '[]'::jsonb
  )
    into v_items_json
  from public.order_items oi
  where oi.order_id = p_order_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order_row.id,
      'status', v_order_row.status,
      'subtotal', v_order_row.subtotal,
      'shipping', v_order_row.shipping,
      'total', v_order_row.total,
      'address', v_order_row.address,
      'created_at', v_order_row.created_at
    ),
    'items', v_items_json,
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'pending', count(*) filter (where proof_status = 'pending'),
        'viewed', count(*) filter (where proof_status = 'viewed'),
        'approved', count(*) filter (where proof_status = 'approved'),
        'edited', count(*) filter (where proof_status = 'edited'),
        'help_requested', count(*) filter (where proof_status = 'help_requested')
      )
      from public.order_items
      where order_id = p_order_id
    )
  );
end;
$$;

grant execute on function public.fn_proof_summary(text) to authenticated;

-- ============================================================
-- 6) RPC: fn_finalize_proof — tüm itemler onaylandıysa state geç
-- ============================================================
-- Müşteri son item'ı onayladığında çağrılır.
-- Atomic: tüm itemler approved mı kontrol et → orders.status = 'proof_approved'
-- Açık help_request varsa veya yarım kalmış item varsa fail döner.
create or replace function public.fn_finalize_proof(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_pending int;
  v_open_help int;
begin
  -- Yetki: sipariş sahibi + status proof_pending olmalı
  select * into v_order from public.orders where id = p_order_id;
  if v_order is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_order.user_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_order.status <> 'proof_pending' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'current_status', v_order.status);
  end if;

  -- Onaylanmamış item var mı?
  select count(*) into v_pending
  from public.order_items
  where order_id = p_order_id
    and proof_status not in ('approved');

  if v_pending > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'pending_items',
      'pending_count', v_pending
    );
  end if;

  -- Açık help request var mı?
  select count(*) into v_open_help
  from public.proof_help_requests
  where order_id = p_order_id
    and status in ('open','in_progress');

  if v_open_help > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'open_help_requests',
      'open_count', v_open_help
    );
  end if;

  -- ATOMIC: orders.status güncelle + order_events log
  update public.orders
     set status = 'proof_approved',
         updated_at = now()
   where id = p_order_id
     and status = 'proof_pending';  -- Çift onaylanma koruması

  insert into public.order_events (
    order_id, event_type, status_after, actor_id, actor_role, summary
  ) values (
    p_order_id, 'proof_approved', 'proof_approved', v_uid, 'customer',
    'Müşteri tüm baskı önizlemelerini onayladı, üretime hazır'
  );

  return jsonb_build_object('ok', true, 'new_status', 'proof_approved');
end;
$$;

grant execute on function public.fn_finalize_proof(text) to authenticated;

-- ============================================================
-- 7) AUTO-TRIGGER: paid → proof_pending (otomatik state geçiş)
-- ============================================================
-- Sefa kararı: ödeme tamamlandığında orders.status='paid' olduktan
-- HEMEN SONRA proof_pending state'ine otomatik geç. Müşteri ödeme
-- callback'inden sonra direkt /onay/[orderId] sayfasına yönlendirilir.
--
-- payment-callback endpoint'i bu trigger'a güvenir.
create or replace function public.fn_auto_advance_to_proof_pending()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Sadece status paid'e geçtiğinde tetikle (idempotent)
  if (TG_OP = 'UPDATE' and OLD.status <> 'paid' and NEW.status = 'paid')
     or (TG_OP = 'INSERT' and NEW.status = 'paid') then
    -- Order item'ı olmayan sipariş geçemez
    if exists (select 1 from public.order_items where order_id = NEW.id) then
      NEW.status := 'proof_pending';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auto_advance_to_proof_pending on public.orders;
create trigger trg_auto_advance_to_proof_pending
  before insert or update of status on public.orders
  for each row
  execute function public.fn_auto_advance_to_proof_pending();

-- ============================================================
-- 8) FK BACK-REF: order_items.cutline_design_id
-- ============================================================
-- Migration order: cutline_designs tablosu yukarıda kuruldu, şimdi FK'yi ekle
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_cutline_design_id_fkey'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_cutline_design_id_fkey
      foreign key (cutline_design_id) references public.cutline_designs(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- NOT: Yorum
-- ============================================================
comment on table public.cutline_designs is
  'POC (pim_etiket_poc.html) tarafından üretilen müşteri onaylı bıçak SVG kayıtları. '
  'Her order_item için 1+ draft, sonunda 1 approved. R2''deki svg_url immutable.';
comment on table public.proof_help_requests is
  'Müşteri baskı onay sayfasında "Yardım iste" derse açılan ticket. '
  'Açık ticket olduğu sürece fn_finalize_proof fail döner.';
comment on column public.order_items.proof_status is
  'Per-item müşteri onay durumu. Sefa 19 May v68 baskı onay akışı (Migration 059).';
