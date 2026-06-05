-- Migration 158: Açılış kampanyası HAZIRAN20 (%20, Haziran 2026)
-- Idempotent — kod zaten varsa ekleme yapılmaz.

insert into public.coupons (
  code,
  kind,
  value,
  max_discount,
  min_subtotal,
  total_uses_limit,
  per_user_limit,
  starts_at,
  expires_at,
  description,
  is_active,
  target_user_id
)
select
  'HAZIRAN20',
  'percent',
  20,
  500,
  100,
  null,
  1,
  now(),
  timestamptz '2026-06-30 23:59:59+03',
  'Açılışa özel — Haziran boyunca %20 indirim (max 500₺, kişi başı 1 kullanım)',
  true,
  null
where not exists (
  select 1 from public.coupons where upper(code) = 'HAZIRAN20'
);
