-- Mig 160: fn_apply_coupon PUBLIC execute kaldır (Mig 159 authenticated/anon yeterli değildi)
-- fn_apply_coupon_admin ile aynı desen: sadece service_role.

REVOKE ALL ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) FROM authenticated;
