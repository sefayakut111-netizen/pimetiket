-- Pim Etiket — Migration 056: settings module RBAC permission
-- Sefa 18 May v68: Settings update super_admin'e kısıtlandı.

insert into public.admin_role_permissions
  (role, module, can_view, can_create, can_update, can_delete, can_approve)
values
  ('super_admin', 'settings', true, true, true, true, true),
  ('operations', 'settings', true, false, false, false, false)
on conflict (role, module) do update set
  can_view = excluded.can_view,
  can_update = excluded.can_update;
