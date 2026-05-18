-- ============================================================
-- Pim Etiket — Migration 055: staff modülü için super_admin yetkisi
--
-- Sefa 18 May v68 (RBAC yayma):
-- Migration 054'te staff modulü permission matrix'e eklenmemişti.
-- Sadece super_admin çalışan listesini görüp rol değiştirebilmeli.
-- ============================================================

insert into public.admin_role_permissions
  (role, module, can_view, can_create, can_update, can_delete, can_approve)
values
  -- Sadece super_admin staff yönetimi yapar
  ('super_admin', 'staff', true, true, true, true, true),
  -- Settings de sadece super_admin (sistem geneli kritik config)
  ('super_admin', 'settings', true, true, true, true, true),
  -- Operations settings'i sadece görüntüleyebilir, değiştiremez
  ('operations', 'settings', true, false, false, false, false)
on conflict (role, module) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve;

-- Migration 054'te '*' kuralı var ama eksplisit insert ediyoruz
-- (admin paneli güvenliği için belirsizlik kalmasın).
