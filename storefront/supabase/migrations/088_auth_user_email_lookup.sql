-- ============================================================
-- Pim Etiket — Migration 088: fn_find_auth_user_by_email RPC
-- ============================================================
--
-- Sefa 23 May v68. Güvenlik analizi P1.6.
-- Tam liste: memory/project_security_findings_2026_05_23.md
--
-- Sorun:
--   /api/partner/auth/otp-request ve
--   /api/admin/impersonate/partner gibi endpoint'lerde
--   `admin.auth.admin.listUsers()` çağrısı default 50 kullanıcı
--   alıyor (üstelik perPage:100 ile bile sınırlı). Pim Etiket
--   < 100 kayıtla bu çalışır ama ölçek büyüyünce email-by-email
--   lookup yanlış user_id döndürebilir veya bulamayabilir.
--
-- Çözüm:
--   security definer RPC ile auth.users'tan tek satır email
--   match yap. Yalnızca service_role çağırabilir (anon/authenticated
--   yetkisi yok).
-- ============================================================

create or replace function public.fn_find_auth_user_by_email(p_email text)
returns table(user_id uuid, email_confirmed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select id as user_id, email_confirmed_at
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;
$$;

revoke execute on function public.fn_find_auth_user_by_email(text)
  from public, anon, authenticated;
grant execute on function public.fn_find_auth_user_by_email(text)
  to service_role;

comment on function public.fn_find_auth_user_by_email(text) is
  'Mig 088 P1.6: Email-by-email auth.users lookup (single row). '
  'listUsers paging hatasını engeller. Yalnızca service_role çağırır.';

-- ============================================================
-- Migration 088 sonu
-- ============================================================
