-- ============================================================
-- Pim Etiket — Migration 085: Security Patches (23 May 2026)
-- ============================================================
--
-- Kaynak: 23 May 2026 güvenlik analizi (Cursor + Claude paralel audit).
-- Tam bulgu listesi: memory/project_security_findings_2026_05_23.md
--
-- Bu migration P0/P1 bulgularından "dokunmaya risk yok" olanları
-- topluyor. Bilinçli alınmış kararlara (Mig 077 INSERT/UPDATE
-- gevşetmesi, Mig 083 Faz 2 partner RLS, Mig 069 refund idempotency)
-- dokunulmadı.
--
-- Düzeltmeler:
--   1. P1.10 — fn_process_proof_pending_sla `authenticated` grant kaldır
--   2. P1.1  — fn_log_failed_login `authenticated` grant kaldır
--   3. P0.5  — design-previews DELETE policy'ye path guard ekle
--   4. P0.6  — partner_contacts self-read policy (Faz 2 minimum)
--
-- Sefa 23 May v68
-- ============================================================

-- ------------------------------------------------------------
-- 1) P1.10 — fn_process_proof_pending_sla cron-only
-- ------------------------------------------------------------
-- Mig 070 satır 105'te `grant execute ... to authenticated` vardı.
-- Auth'lu herhangi bir kullanıcı bu RPC'yi tetikleyip 36+ saatlik
-- orderları toplu iptal edebilirdi. Cron tek caller olmalı.
-- ------------------------------------------------------------

revoke execute on function public.fn_process_proof_pending_sla() from authenticated;
revoke execute on function public.fn_process_proof_pending_sla() from anon;
-- service_role grant Mig 070 satır 106'da zaten var, cron buradan çağırır.

comment on function public.fn_process_proof_pending_sla() is
  'P1 #10 SLA kaskadı — 12sa pre-warning + 36sa auto-refund. '
  'Mig 085 ile authenticated grant kaldırıldı, sadece service_role (cron-only).';


-- ------------------------------------------------------------
-- 2) P1.1 — fn_log_failed_login cron/server-only
-- ------------------------------------------------------------
-- Mig 041 satır 202-203: `to authenticated, service_role`. Auth'lu
-- kullanıcı Supabase client ile RPC'yi doğrudan çağırıp sahte e-posta
-- /IP kayıtları üretebilir (auth_failed_logins tablosunu şişirme +
-- IP block listesinde false positive). Sadece app endpoint'i
-- (service-role) çağırmalı.
-- ------------------------------------------------------------

revoke execute on function public.fn_log_failed_login(text, inet, text, text) from authenticated;
revoke execute on function public.fn_log_failed_login(text, inet, text, text) from anon;
-- service_role grant korunuyor — app endpoint'i (log-failed-login route)
-- bu RPC'yi service_role client ile çağırmaya devam edebilir.

comment on function public.fn_log_failed_login(text, inet, text, text) is
  'App''ın auth endpoint''i tarafından çağrılır — başarısız giriş kaydı. '
  'Mig 085 ile authenticated grant kaldırıldı (DoS + false positive '
  'koruması). Yalnızca service_role çağırabilir.';


-- ------------------------------------------------------------
-- 3) P0.5 — design-previews DELETE policy path guard
-- ------------------------------------------------------------
-- Mig 077'de DELETE policy `bucket_id = 'design-previews'` only şeklinde
-- bırakılmıştı. INSERT/UPDATE bilinçli gevşek (yorum Mig 077:39-47).
-- DELETE için path guard ekliyoruz — saldırgan başkasının preview'unu
-- silemesin. Silinen veri re-generate edilebilir ama gereksiz açık.
--
-- ⚠️ Mig 077 ile aynı not: Supabase yönetilen ortamda storage.objects
-- sahibi `supabase_storage_admin`. Bu blok Dashboard SQL Editor'de
-- 42501 verebilir. O durumda Storage → Policies UI'dan manuel uygula:
--   1. design_previews_auth_delete policy'sini sil
--   2. Yeni policy yarat:
--        Name: design_previews_owner_delete_v2
--        Operation: DELETE
--        Target: authenticated
--        USING: bucket_id = 'design-previews'
--               AND (storage.foldername(name))[1] = auth.uid()::text
-- ------------------------------------------------------------

set local role supabase_storage_admin;

drop policy if exists "design_previews_auth_delete" on storage.objects;

create policy "design_previews_owner_delete_v2" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'design-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on policy "design_previews_owner_delete_v2" on storage.objects is
  'Mig 085 P0.5: DELETE için path guard restore. Authenticated kullanıcı '
  'sadece kendi {user_id}/ klasöründeki preview''ları silebilir. INSERT/'
  'UPDATE Mig 077 gerekçesiyle bilinçli gevşek bırakıldı.';

reset role;


-- ------------------------------------------------------------
-- 4) P0.6 — partner_contacts self-read policy
-- ------------------------------------------------------------
-- Mig 083 `partner` rolünü user_role enum'a ekledi ama hiçbir RLS
-- policy'sini güncellemedi. Faz 2'de tam RLS planlanmış (Mig 083
-- yorum satır 27). Bu arada minimum: partner kendi kayıtlarını
-- okuyabilmeli (Supabase auth callback sonrası /partner dashboard
-- yüklenirken). Yazma/silme yetkisi service-role'e bırakılıyor.
-- ------------------------------------------------------------

drop policy if exists "Partner sees own contact rows" on public.partner_contacts;
create policy "Partner sees own contact rows"
  on public.partner_contacts for select
  to authenticated
  using (user_id = auth.uid());

comment on policy "Partner sees own contact rows" on public.partner_contacts is
  'Mig 085 P0.6: Partner kendi partner_contacts satırını okuyabilir. '
  'Mig 067 admin/staff SELECT policy''si yan yana çalışır (PostgreSQL '
  'multiple policy OR logic). Yazma/silme service_role''dadır.';


-- ============================================================
-- Migration 085 sonu
-- ============================================================
-- Rollback:
--   grant execute on function public.fn_process_proof_pending_sla() to authenticated;
--   grant execute on function public.fn_log_failed_login(text, inet, text, text) to authenticated;
--   set local role supabase_storage_admin;
--   drop policy if exists "design_previews_owner_delete_v2" on storage.objects;
--   create policy "design_previews_auth_delete" on storage.objects
--     for delete to authenticated using (bucket_id = 'design-previews');
--   reset role;
--   drop policy if exists "Partner sees own contact rows" on public.partner_contacts;
