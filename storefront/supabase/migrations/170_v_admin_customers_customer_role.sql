-- Mig 170 — v_admin_customers: yalnızca role=customer (admin/staff hariç)
-- Dashboard customer-stats (profiles.role=customer) ile KPI hizalama

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
  p.display_name,
  p.phone,
  p.invoice_type,
  coalesce(o.order_count, 0) as order_count,
  coalesce(o.active_count, 0) as active_orders,
  coalesce(o.total_revenue, 0) as total_revenue,
  coalesce(o.avg_order, 0) as avg_order,
  o.last_order_at,
  o.last_order_id,
  o.first_order_at,
  coalesce(lg.total_granted, 0) as total_loyalty_granted,
  exists (
    select 1 from auth.mfa_factors mf
      where mf.user_id = au.id
        and mf.status = 'verified'
  ) as has_2fa,
  coalesce(
    (select array_agg(tag order by created_at desc)
      from public.customer_tags ct
      where ct.user_id = au.id),
    array[]::text[]
  ) as tags,
  (select count(*)::int
    from public.customer_notes cn
    where cn.user_id = au.id) as notes_count,
  exists (
    select 1 from public.email_subscribers es
      where lower(es.email) = lower(au.email)
  ) as marketing_subscribed
from auth.users au
inner join public.profiles p on p.id = au.id and p.role = 'customer'
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
  'Admin CRM liste — profiles.role=customer (admin/staff hariç). Dashboard customer-stats ile aynı tanım.';
