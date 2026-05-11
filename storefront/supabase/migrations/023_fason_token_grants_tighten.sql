-- ============================================================
-- Pim Etiket — Migration 023: Fason token RPC grant'lerini sıkılaştır
--
-- Güvenlik denetimi P0:
--   Migration 020'de fn_generate_fason_token + fn_validate_fason_token
--   GRANT EXECUTE TO authenticated verilmişti. Bu, herhangi bir müşteri
--   rolünün kendi UUID'sini parametre geçip token üretmesine izin verir
--   (security definer + RLS bypass riski).
--
-- Çözüm:
--   GRANT'i sadece service_role'da tut. authenticated revoke.
-- ============================================================

revoke execute on function public.fn_generate_fason_token(uuid, uuid, integer)
  from authenticated;

revoke execute on function public.fn_validate_fason_token(text)
  from authenticated;

-- Service role grant'leri zaten Migration 020'de tanımlı; tekrar grant
-- yapmıyoruz (idempotent koruma).

-- ============================================================
-- Migration 023 sonu
-- ============================================================
