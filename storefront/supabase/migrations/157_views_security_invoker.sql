-- Mig 157: Security Advisor — SECURITY DEFINER view → security_invoker
--
-- Kod taraması (2026-06-05):
--   v_fason_performance       → service_role only (admin API)
--   v_auditor_latest_runs    → service_role only (admin API + cron)
--   v_auditor_pending_count  → service_role only (admin API)
--   v_pricing_live           → MÜŞTERİ-FACING (browser createClient/anon) — DIŞARIDA BIRAKILDI
--
-- v_pricing_live: Mig 134 bilinçli olarak security_invoker=false kullanıyor;
-- pricing_config tablosunda anon RLS kaldırıldı, view SECURITY DEFINER ile live_config açıyor.
-- security_invoker=true eklemek /sticker ve /etiket fiyat okumasını kırar → ayrı RLS tasarımı gerekir.

ALTER VIEW public.v_fason_performance    SET (security_invoker = true);
ALTER VIEW public.v_auditor_latest_runs  SET (security_invoker = true);
ALTER VIEW public.v_auditor_pending_count SET (security_invoker = true);
