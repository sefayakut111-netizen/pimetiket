-- ============================================================
-- Pim Etiket — Migration 046: Admin CRM (Customer 360°)
--
-- Sefa 17 May: "Üyeleri takip + aksiyon admin alanı"
--
-- Eklenenler:
--   1. customer_notes — operator internal notes (Stripe pattern)
--   2. customer_tags — Shopify-style etiket sistemi
--   3. loyalty_grants — manuel kontör verme log
--   4. v_admin_customers — auth.users + orders aggregate (liste için)
--   5. v_customer_activity — events timeline (detay sayfa için)
--   6. fn_admin_customer_360 — RPC tek seferde tam profil
-- ============================================================

-- ============================================================
-- 1. customer_notes (internal CRM notes — operator)
-- ============================================================

create table if not exists public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete set null,
  author_name text,  -- snapshot (auth user silinirse author_id null kalır)
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_customer_notes_user
  on public.customer_notes (user_id, created_at desc);

create index if not exists idx_customer_notes_pinned
  on public.customer_notes (user_id, pinned)
  where pinned = true;

alter table public.customer_notes enable row level security;

-- Sadece admin role okur/yazar
drop policy if exists "notes_admin_all" on public.customer_notes;
create policy "notes_admin_all"
  on public.customer_notes
  for all
  using (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- 2. customer_tags (Shopify-style tag)
-- ============================================================

create table if not exists public.customer_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tag        text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, tag)
);

create index if not exists idx_customer_tags_user
  on public.customer_tags (user_id);

create index if not exists idx_customer_tags_tag
  on public.customer_tags (tag);

alter table public.customer_tags enable row level security;

drop policy if exists "tags_admin_all" on public.customer_tags;
create policy "tags_admin_all"
  on public.customer_tags
  for all
  using (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- 3. loyalty_grants (manuel kontör verme log)
-- ============================================================

create table if not exists public.loyalty_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  admin_id   uuid references auth.users(id) on delete set null,
  amount_try numeric(10, 2) not null check (amount_try > 0),
  reason     text not null,
  status     text not null default 'granted'
    check (status in ('granted', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists idx_loyalty_grants_user
  on public.loyalty_grants (user_id, created_at desc);

alter table public.loyalty_grants enable row level security;

drop policy if exists "grants_admin_all" on public.loyalty_grants;
create policy "grants_admin_all"
  on public.loyalty_grants
  for all
  using (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- 4. v_admin_customers — liste sayfası view
--
-- Tüm auth.users (kayıt vermiş) + orders aggregate.
-- Sipariş vermemiş kullanıcılar da görünür ("Yeni" segment).
-- ============================================================

create or replace view public.v_admin_customers
with (security_invoker = true)
as
select
  au.id as user_id,
  au.email,
  au.email_confirmed_at,
  au.last_sign_in_at,
  au.created_at as registered_at,
  au.banned_until,
  -- Profile
  p.display_name,
  p.phone,
  p.invoice_type,
  -- Order aggregate
  coalesce(o.order_count, 0) as order_count,
  coalesce(o.active_count, 0) as active_orders,
  coalesce(o.total_revenue, 0) as total_revenue,
  coalesce(o.avg_order, 0) as avg_order,
  o.last_order_at,
  o.last_order_id,
  o.first_order_at,
  -- Loyalty
  coalesce(lg.total_granted, 0) as total_loyalty_granted,
  -- 2FA
  exists (
    select 1 from auth.mfa_factors mf
      where mf.user_id = au.id
        and mf.status = 'verified'
  ) as has_2fa,
  -- Tags
  coalesce(
    (select array_agg(tag order by created_at desc)
      from public.customer_tags ct
      where ct.user_id = au.id),
    array[]::text[]
  ) as tags,
  -- Notes count
  (select count(*)::int
    from public.customer_notes cn
    where cn.user_id = au.id) as notes_count,
  -- Marketing consent (email_subscribers — kayıt varsa KVKK m.5/1/a
  -- açık rıza alındı demektir, ayrı flag yok)
  exists (
    select 1 from public.email_subscribers es
      where lower(es.email) = lower(au.email)
  ) as marketing_subscribed
  from auth.users au
  left join public.profiles p on p.id = au.id
  left join lateral (
    select
      count(*) as order_count,
      count(*) filter (where o.status not in ('delivered', 'cancelled')) as active_count,
      sum(o.total) as total_revenue,
      avg(o.total) as avg_order,
      max(o.created_at) as last_order_at,
      min(o.created_at) as first_order_at,
      (select id from public.orders where user_id = au.id order by created_at desc limit 1) as last_order_id
      from public.orders o
      where o.user_id = au.id
  ) o on true
  left join lateral (
    select sum(amount_try) as total_granted
      from public.loyalty_grants
      where user_id = au.id and status = 'granted'
  ) lg on true;

comment on view public.v_admin_customers is
  'Admin CRM liste view — auth.users + orders + profiles + tags + 2FA + loyalty aggregate. security_invoker: caller''ın yetkisiyle çalışır (admin RLS gerekir).';

-- ============================================================
-- 5. v_customer_activity — detay sayfa timeline
-- ============================================================

create or replace view public.v_customer_activity
with (security_invoker = true)
as
-- Sipariş eventleri
select
  oe.order_id as ref_id,
  o.user_id,
  oe.created_at,
  'order_event' as kind,
  oe.event_type as title,
  coalesce(oe.summary, '') as detail,
  '🛒' as emoji
  from public.order_events oe
  join public.orders o on o.id = oe.order_id
  where o.user_id is not null
union all
-- Login events (auth.users.last_sign_in_at — bu sadece son, tarih sınırlı)
select
  au.id::text as ref_id,
  au.id as user_id,
  au.last_sign_in_at as created_at,
  'auth' as kind,
  'login' as title,
  'Sisteme giriş yapıldı' as detail,
  '🔐' as emoji
  from auth.users au
  where au.last_sign_in_at is not null
union all
-- Mail gönderim
select
  mo.target_id as ref_id,
  o.user_id,
  mo.created_at,
  'mail' as kind,
  mo.template_key as title,
  'Mail: ' || coalesce(mo.subject, mo.template_key) as detail,
  '📧' as emoji
  from public.fason_mail_outbox mo
  left join public.orders o on o.id = mo.target_id and mo.target_type = 'order'
  where mo.category = 'customer'
    and o.user_id is not null
union all
-- Notes
select
  cn.id::text as ref_id,
  cn.user_id,
  cn.created_at,
  'note' as kind,
  'Internal note' as title,
  cn.body as detail,
  '📝' as emoji
  from public.customer_notes cn
union all
-- Loyalty grants
select
  lg.id::text as ref_id,
  lg.user_id,
  lg.created_at,
  'loyalty' as kind,
  case when lg.status = 'granted' then 'Kontör verildi'
       else 'Kontör iptal edildi' end as title,
  lg.amount_try::text || ' ₺ — ' || lg.reason as detail,
  '🎁' as emoji
  from public.loyalty_grants lg
order by created_at desc;

comment on view public.v_customer_activity is
  'Müşteri detay sayfası timeline — order events + logins + mails + notes + loyalty union.';

-- ============================================================
-- 6. fn_admin_customer_360 — tek RPC, detay sayfa için tam profil
-- ============================================================

create or replace function public.fn_admin_customer_360(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_result jsonb;
begin
  -- Yetki kontrolü
  select exists (
    select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'forbidden';
  end if;

  -- Müşteri özet + son 20 aktivite + son 10 sipariş + tüm notlar + tüm taglar
  select jsonb_build_object(
    'overview', (
      select to_jsonb(c) from public.v_admin_customers c
        where c.user_id = p_user_id
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(a), '[]'::jsonb) from (
        select * from public.v_customer_activity
          where user_id = p_user_id
          order by created_at desc
          limit 20
      ) a
    ),
    'orders', (
      select coalesce(jsonb_agg(o), '[]'::jsonb) from (
        select id, status, total, created_at, items_count
          from public.orders ord
          left join lateral (
            select count(*) as items_count from public.order_items
              where order_id = ord.id
          ) i on true
          where user_id = p_user_id
          order by created_at desc
          limit 10
      ) o
    ),
    'notes', (
      select coalesce(jsonb_agg(n), '[]'::jsonb) from (
        select id, body, pinned, author_name, created_at
          from public.customer_notes
          where user_id = p_user_id
          order by pinned desc, created_at desc
      ) n
    ),
    'tags', (
      select coalesce(jsonb_agg(tag order by created_at desc), '[]'::jsonb)
        from public.customer_tags
        where user_id = p_user_id
    ),
    'loyalty_grants', (
      select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select id, amount_try, reason, status, created_at
          from public.loyalty_grants
          where user_id = p_user_id
          order by created_at desc
      ) g
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.fn_admin_customer_360(uuid) to authenticated;

comment on function public.fn_admin_customer_360 is
  'Admin müşteri 360° — overview + recent_activity (20) + orders (10) + notes + tags + grants. Service-side admin RLS check.';

-- ============================================================
-- 7. Triggers — updated_at auto-touch
-- ============================================================

drop trigger if exists trg_customer_notes_touch on public.customer_notes;
create trigger trg_customer_notes_touch
  before update on public.customer_notes
  for each row execute function public.fn_touch_updated_at();
