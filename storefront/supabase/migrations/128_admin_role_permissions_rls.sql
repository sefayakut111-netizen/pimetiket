-- Mig 128: admin_role_permissions RLS — RBAC yetki matrisi koruması
-- Mig 054 tabloyu oluşturdu ama RLS/policy eklemedi.

alter table public.admin_role_permissions enable row level security;

drop policy if exists "admin_role_permissions_read" on public.admin_role_permissions;
create policy "admin_role_permissions_read"
  on public.admin_role_permissions for select to authenticated
  using (public.is_admin());
-- INSERT/UPDATE/DELETE: yalnızca service_role (policy yok → authenticated yazamaz)
