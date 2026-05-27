-- Migration 114: fn_create_order — authenticated grant kaldır
--
-- fn_create_order doğrudan "paid" sipariş oluşturur; payment callback
-- dışında authenticated kullanıcıların çağırması ücretsiz sipariş açığıdır.
-- Yalnızca service_role (server-side admin bypass / dev mock) çağırabilir.

revoke execute on function public.fn_create_order(
  text, uuid, numeric, numeric, numeric, jsonb, jsonb, jsonb, date, jsonb
) from authenticated;

revoke execute on function public.fn_create_order(
  text, uuid, numeric, numeric, numeric, jsonb, jsonb, jsonb, date, jsonb
) from anon;

comment on function public.fn_create_order is
  'Atomik sipariş oluşturma — Mig 114 ile yalnızca service_role. '
  'Müşteri akışı fn_finalize_paid_order (PayTR callback) üzerinden.';
