-- ============================================================
-- Pim Etiket — Migration 091: Mevcut admin/staff kullanıcılarına admin_role ata
--
-- admin → super_admin (tam yetki)
-- staff → production (üretim odaklı kısıtlı erişim)
-- Zaten admin_role set edilmiş kullanıcılar dokunulmaz.
-- ============================================================

update public.profiles
set admin_role = 'super_admin'::public.admin_role_v2
where role = 'admin'
  and admin_role is null;

update public.profiles
set admin_role = 'production'::public.admin_role_v2
where role = 'staff'
  and admin_role is null;
