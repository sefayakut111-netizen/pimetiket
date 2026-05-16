-- ============================================================
-- Pim Etiket — Migration 045: Kargo Müşteri Görünümü + Email Outbox
--
-- Sefa 17 May:
-- Mevcut sistem (Migration 018) order_assignments tablosunda
-- tracking_company / tracking_number / tracking_url alanlarına sahip.
-- Fason "/api/fason/update?action=shipped" çağrısında bunlar dolduruluyor.
--
-- Bu migration 3 şey ekler:
--   1. fn_get_my_order_shipment RPC — müşteri kendi siparişinin kargo
--      bilgisini güvenli şekilde okuyabilir (RLS bypass + scope kontrol).
--   2. fn_notify_customer_shipped trigger — assignment 'shipped' olunca
--      mail_outbox'a "kargoya verildi" maili ekle (Resend gönderir).
--   3. shipment_carriers reference tablo — UI dropdown için yurt içi
--      kargo şirketleri listesi.
-- ============================================================

-- ============================================================
-- 1. Reference: yurt içi kargo şirketleri
-- ============================================================

create table if not exists public.shipment_carriers (
  code         text primary key,                 -- 'yurtici', 'aras', ...
  display_name text not null,
  -- Takip URL template, {{TRACKING_NUMBER}} replace edilir
  tracking_url_template text,
  -- Aktif mi (dropdown'a düşer mi)
  active       boolean not null default true,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now()
);

-- Seed: Türkiye'nin yaygın 6 yurt içi kargo şirketi
insert into public.shipment_carriers
  (code, display_name, tracking_url_template, sort_order, active)
values
  ('yurtici', 'Yurtiçi Kargo',
   'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={{TRACKING_NUMBER}}',
   10, true),
  ('aras', 'Aras Kargo',
   'https://kargotakip.araskargo.com.tr/?code={{TRACKING_NUMBER}}',
   20, true),
  ('mng', 'MNG Kargo',
   'https://service.mngkargo.com.tr/iframe/track.aspx?id={{TRACKING_NUMBER}}',
   30, true),
  ('ptt', 'PTT Kargo',
   'https://gonderitakip.ptt.gov.tr/Track/Verify?q={{TRACKING_NUMBER}}',
   40, true),
  ('surat', 'Sürat Kargo',
   'https://www.suratkargo.com.tr/KargoTakip/?kargotakipno={{TRACKING_NUMBER}}',
   50, true),
  ('hepsijet', 'HepsiJet',
   'https://hepsijet.com/gonderi-takibi?gonderiId={{TRACKING_NUMBER}}',
   60, true),
  ('ups', 'UPS Kargo',
   'https://www.ups.com/track?tracknum={{TRACKING_NUMBER}}',
   70, true),
  ('diger', 'Diğer (manuel link)',
   null,
   999, true)
on conflict (code) do update
  set display_name = excluded.display_name,
      tracking_url_template = excluded.tracking_url_template,
      sort_order = excluded.sort_order,
      active = excluded.active;

-- RLS: public okuyabilir (dropdown için)
alter table public.shipment_carriers enable row level security;
drop policy if exists "carriers_public_read" on public.shipment_carriers;
create policy "carriers_public_read"
  on public.shipment_carriers
  for select
  to anon, authenticated
  using (active = true);

-- ============================================================
-- 2. RPC: müşteri kendi siparişinin kargo bilgisini güvenli okuma
-- ============================================================

create or replace function public.fn_get_my_order_shipment(
  p_order_id text
)
returns table (
  has_shipment    boolean,
  carrier_code    text,
  carrier_label   text,
  tracking_number text,
  tracking_url    text,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  status          text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Auth: kullanıcı login mi?
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  -- Scope: kullanıcı bu siparişin sahibi mi?
  if not exists (
    select 1 from public.orders
      where id = p_order_id
        and user_id = auth.uid()
  ) then
    raise exception 'order_not_found_or_forbidden';
  end if;

  return query
  select
    (oa.tracking_number is not null) as has_shipment,
    -- Carrier code: tracking_company text alanından match (lowercase'e bak)
    coalesce(
      (select c.code from public.shipment_carriers c
        where lower(c.display_name) = lower(oa.tracking_company)
           or c.code = lower(oa.tracking_company)
        limit 1),
      'diger'
    ) as carrier_code,
    oa.tracking_company as carrier_label,
    oa.tracking_number,
    -- URL: manuel girildiyse onu, yoksa template'den üret
    coalesce(
      oa.tracking_url,
      (select replace(c.tracking_url_template, '{{TRACKING_NUMBER}}', oa.tracking_number)
        from public.shipment_carriers c
        where (lower(c.display_name) = lower(oa.tracking_company)
            or c.code = lower(oa.tracking_company))
          and c.tracking_url_template is not null
        limit 1)
    ) as tracking_url,
    oa.shipped_at,
    oa.actual_delivery::timestamptz as delivered_at,
    oa.status::text
    from public.order_assignments oa
    where oa.order_id = p_order_id
      and oa.status in ('shipped', 'ready')
    order by oa.shipped_at desc nulls last,
             oa.assigned_at desc
    limit 1;
end;
$$;

grant execute on function public.fn_get_my_order_shipment(text) to authenticated;

comment on function public.fn_get_my_order_shipment is
  'Müşteri için kendi siparişinin kargo bilgisi (carrier + tracking + url). RLS scope: orders.user_id = auth.uid().';

-- ============================================================
-- 3. Trigger: order_assignments shipped → mail_outbox'a ekle
-- ============================================================

create or replace function public.fn_notify_customer_shipped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email text;
  v_user_name text;
  v_carrier text;
  v_tracking text;
  v_track_url text;
begin
  -- Sadece shipped'e geçişte (eski status ≠ shipped, yeni status = shipped)
  if new.status <> 'shipped' then
    return new;
  end if;
  if old is not null and old.status = 'shipped' then
    return new; -- idempotent: aynı assignment 2x trigger olursa skip
  end if;

  -- Müşterinin email + adı
  select au.email,
         coalesce(p.display_name, split_part(au.email, '@', 1))
    into v_user_email, v_user_name
    from public.orders o
    join auth.users au on au.id = o.user_id
    left join public.profiles p on p.id = o.user_id
    where o.id = new.order_id;

  if v_user_email is null then
    return new; -- e-postası yok, skip
  end if;

  v_carrier := coalesce(new.tracking_company, 'Kargo şirketi');
  v_tracking := coalesce(new.tracking_number, '');

  -- Tracking URL: manuel veya template
  v_track_url := new.tracking_url;
  if v_track_url is null and v_tracking <> '' then
    select replace(c.tracking_url_template, '{{TRACKING_NUMBER}}', v_tracking)
      into v_track_url
      from public.shipment_carriers c
      where (lower(c.display_name) = lower(v_carrier)
          or c.code = lower(v_carrier))
        and c.tracking_url_template is not null
      limit 1;
  end if;

  -- fason_mail_outbox'a ekle (Migration 035/037 ile generic schema'ya
  -- dönüştürüldü — assignment_id NULL kabul ediyor, target_type='order'
  -- ile order_id text PE-2026-XXXX referansı tutulur)
  -- Template: 'customer_shipped' (templates.ts renderCustomerShipped)
  -- Payload key uyumu: carrier + tracking_no + tracking_url
  insert into public.fason_mail_outbox (
    assignment_id,
    template_key,
    to_email,
    subject,
    payload,
    category,
    target_type,
    target_id,
    status,
    attempts
  ) values (
    new.id,             -- shipped olan assignment id (bilgi için)
    'customer_shipped',
    lower(v_user_email),
    'Siparişin kargoya verildi — ' || new.order_id,
    jsonb_build_object(
      'order_id', new.order_id,
      'orderId', new.order_id,                -- camelCase fallback
      'customer_name', v_user_name,
      'carrier', v_carrier,
      'tracking_no', v_tracking,              -- templates.ts bunu okur
      'tracking_number', v_tracking,          -- alt key
      'tracking_url', v_track_url
    ),
    'customer',
    'order',
    new.order_id,
    'pending',
    0
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_customer_shipped
  on public.order_assignments;
create trigger trg_notify_customer_shipped
  after update of status on public.order_assignments
  for each row
  when (new.status = 'shipped')
  execute function public.fn_notify_customer_shipped();

comment on function public.fn_notify_customer_shipped is
  'order_assignments status=shipped olunca mail_outbox''a kargoya verildi maili insert eder. Idempotent.';

-- ============================================================
-- 4. RPC: aktif kargo şirketlerini listele (UI dropdown)
-- ============================================================

create or replace function public.fn_list_carriers()
returns table (
  code text,
  display_name text,
  has_template boolean
)
language sql
security definer
set search_path = public
as $$
  select c.code, c.display_name, (c.tracking_url_template is not null)
    from public.shipment_carriers c
    where c.active = true
    order by c.sort_order;
$$;

grant execute on function public.fn_list_carriers() to anon, authenticated;
