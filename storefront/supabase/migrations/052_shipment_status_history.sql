-- ============================================================
-- Pim Etiket — Migration 052: Kargo Durum Geçmişi (Yurtiçi API)
--
-- Sefa 18 May v68:
-- Migration 045 ile tek-noktalı tracking (carrier + number + url) zaten
-- mevcuttu. Bu migration Yurtiçi Kargo SOAP API entegrasyonuyla gelen
-- DURUM GEÇMİŞİ akışını destekler:
--   - "Kargoya verildi" → "Yola çıktı" → "Dağıtımda" → "Teslim edildi"
--   - Her durum değişikliği timeline kaydı düşer
--   - Cron job /api/cron/poll-shipments her 4 saatte poll yapar
--
-- 3 değişiklik:
--   1. order_assignments'a 3 yeni kolon (poll metadata)
--   2. Yeni tablo: shipment_status_events (timeline)
--   3. Yeni RPC: fn_get_my_shipment_timeline (müşteri okuma)
-- ============================================================

-- =========================================================
-- 1. ORDER_ASSIGNMENTS'A POLL METADATA KOLONLARI
-- =========================================================
alter table public.order_assignments
  add column if not exists tracking_status text,
  add column if not exists tracking_last_polled_at timestamptz,
  add column if not exists tracking_delivered_at timestamptz;

-- Cron index (sadece tracking_number'ı olan + delivered olmayan satırlar)
create index if not exists idx_order_assignments_poll
  on public.order_assignments(tracking_last_polled_at)
  where tracking_number is not null
    and tracking_delivered_at is null;

comment on column public.order_assignments.tracking_status is
  'Normalized cargo status: pending|in_transit|out_for_delivery|delivered|failed|returned (Yurtiçi API normalize)';
comment on column public.order_assignments.tracking_last_polled_at is
  'Cron son ne zaman bu kargo statüsünü sorguladı (rate limit + tekrar etmeme için)';

-- =========================================================
-- 2. SHIPMENT_STATUS_EVENTS TABLOSU (TIMELINE)
-- =========================================================
create table if not exists public.shipment_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  assignment_id uuid references public.order_assignments(id) on delete cascade,
  -- Normalize status
  status text not null check (status in (
    'created',          -- Kargo barkod oluşturuldu
    'picked_up',        -- Kargo aldı (matbaa pickup)
    'in_transit',       -- Yolda / ana dağıtım merkezinde
    'out_for_delivery', -- Dağıtımda (kurye elinde)
    'delivered',        -- Teslim edildi
    'failed',           -- Teslimat başarısız (kapı kapalı, alıcı yok)
    'returned',         -- İade edildi (3 deneme sonrası)
    'cancelled'         -- Kargo iptal
  )),
  -- Yurtiçi'nin ham status kodu (örn 'A', 'T', 'I') — debug/audit için
  raw_status_code text,
  -- Açıklama (TR): "Şubeye geldi", "Kurye dağıtıma çıktı", vb
  description text,
  -- Lokasyon: "İstanbul - Ümraniye Şubesi"
  location text,
  -- Yurtiçi'nin event zamanı (gelen veriden)
  event_time timestamptz not null,
  -- Bizim poll zamanımız (cron veya manuel)
  polled_at timestamptz not null default now(),
  -- API'den dönen ham payload (debug için)
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipment_events_order
  on public.shipment_status_events(order_id, event_time desc);
create index if not exists idx_shipment_events_assignment
  on public.shipment_status_events(assignment_id, event_time desc);
-- Idempotent insert için unique constraint
-- Aynı order_id + status + event_time = aynı event (tekrar polled olsa bile insert tetiklenmez)
create unique index if not exists uniq_shipment_event_dedupe
  on public.shipment_status_events(order_id, status, event_time);

comment on table public.shipment_status_events is
  'Kargo durum geçmişi timeline. Her status değişikliği bir satır. Cron /api/cron/poll-shipments tarafından doldurulur.';

-- =========================================================
-- 3. RLS — Müşteri kendi siparişinin event'lerini okur
-- =========================================================
alter table public.shipment_status_events enable row level security;

drop policy if exists "customer_read_own_shipment_events" on public.shipment_status_events;
create policy "customer_read_own_shipment_events"
  on public.shipment_status_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = shipment_status_events.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "admin_read_all_shipment_events" on public.shipment_status_events;
create policy "admin_read_all_shipment_events"
  on public.shipment_status_events for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
    )
  );

-- Service role bypass eder; kullanıcı insert/update/delete yapamaz
drop policy if exists "block_user_modify_shipment_events" on public.shipment_status_events;
create policy "block_user_modify_shipment_events"
  on public.shipment_status_events for insert
  with check (false);

-- =========================================================
-- 4. RPC: MÜŞTERİ TIMELINE OKUMA (RLS scoped)
-- =========================================================
create or replace function public.fn_get_my_shipment_timeline(
  p_order_id text
)
returns table (
  status text,
  description text,
  location text,
  event_time timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  if not exists (
    select 1 from public.orders
      where id = p_order_id
        and user_id = auth.uid()
  ) then
    raise exception 'order_not_found_or_forbidden';
  end if;

  return query
  select
    se.status,
    se.description,
    se.location,
    se.event_time
    from public.shipment_status_events se
    where se.order_id = p_order_id
    order by se.event_time asc;
end;
$$;

grant execute on function public.fn_get_my_shipment_timeline(text) to authenticated;

comment on function public.fn_get_my_shipment_timeline is
  'Müşteri için kendi siparişinin kargo durum geçmişi (chronological order).';

-- =========================================================
-- 5. RPC: CRON POLL ADAYLARINI ÇEK
-- =========================================================
-- Sadece tracking_number'ı olan + delivered olmayan + son 30 günde
-- shipped olmuş + son poll'dan en az 4 saat geçmiş kargo'lar
create or replace function public.fn_get_shipment_poll_candidates(
  p_min_age_minutes int default 240,  -- 4 saat
  p_limit int default 50
)
returns table (
  assignment_id uuid,
  order_id text,
  tracking_number text,
  tracking_company text,
  shipped_at timestamptz,
  last_polled_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oa.id as assignment_id,
    oa.order_id,
    oa.tracking_number,
    oa.tracking_company,
    oa.shipped_at,
    oa.tracking_last_polled_at
    from public.order_assignments oa
    where oa.tracking_number is not null
      and oa.tracking_delivered_at is null
      and oa.shipped_at is not null
      and oa.shipped_at > (now() - interval '30 days')
      and (
        oa.tracking_last_polled_at is null
        or oa.tracking_last_polled_at < (now() - (p_min_age_minutes || ' minutes')::interval)
      )
    order by oa.tracking_last_polled_at asc nulls first,
             oa.shipped_at desc
    limit p_limit
$$;

comment on function public.fn_get_shipment_poll_candidates is
  'Cron için: hangi kargolar şimdi Yurtiçi API''den durum sorulmalı? min 4 saat ara, max 30 gün.';
