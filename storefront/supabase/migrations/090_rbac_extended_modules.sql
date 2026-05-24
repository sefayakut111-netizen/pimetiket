-- ============================================================
-- Pim Etiket — Migration 090: RBAC extended modules + user permissions RPC
--
-- Eksik modüller permission matrisine eklenir; production rolü genişletilir;
-- UI/middleware için fn_list_user_permissions() RPC eklenir.
-- ============================================================

insert into public.admin_role_permissions
  (role, module, can_view, can_create, can_update, can_delete, can_approve)
values
  -- Dashboard — tüm admin rolleri operasyonel özeti görebilir
  ('super_admin', 'dashboard', true, true, true, true, true),
  ('operations', 'dashboard', true, false, false, false, false),
  ('customer_service', 'dashboard', true, false, false, false, false),
  ('production', 'dashboard', true, false, false, false, false),
  ('content_editor', 'dashboard', true, false, false, false, false),

  -- Finans (sadece super_admin + operations görüntüler)
  ('super_admin', 'finans', true, true, true, true, true),
  ('operations', 'finans', true, false, false, false, false),

  -- Kuponlar
  ('super_admin', 'coupons', true, true, true, true, true),
  ('operations', 'coupons', true, true, true, true, false),

  -- Fiyat yönetimi
  ('super_admin', 'pricing', true, true, true, true, true),

  -- Denetçiler (AI agent sistemi)
  ('super_admin', 'auditors', true, true, true, true, true),
  ('operations', 'auditors', true, false, false, false, true),

  -- Yardım talepleri (proof help)
  ('super_admin', 'help_requests', true, true, true, true, true),
  ('operations', 'help_requests', true, true, true, false, true),
  ('production', 'help_requests', true, false, true, false, false),
  ('customer_service', 'help_requests', true, true, true, false, true),

  -- Yedekler
  ('super_admin', 'backups', true, true, true, true, true),

  -- Arşiv (R2)
  ('super_admin', 'archive', true, true, true, true, true),
  ('operations', 'archive', true, false, false, false, false),

  -- Mail sağlığı
  ('super_admin', 'mail_health', true, true, true, true, true),
  ('operations', 'mail_health', true, false, false, false, false),

  -- Audit log
  ('super_admin', 'audit_log', true, false, false, false, false),
  ('operations', 'audit_log', true, false, false, false, false),

  -- Ürün kartları
  ('super_admin', 'products', true, true, true, true, true),
  ('content_editor', 'products', true, true, true, true, false),

  -- Production: fason görüntüleme (atama listesi)
  ('production', 'fason', true, false, false, false, false),

  -- Customer service: rapor görüntüleme (finans olmadan)
  ('customer_service', 'reports', true, false, false, false, false),

  -- Content editor: rapor yok, finans yok
  ('content_editor', 'blog', true, true, true, true, false)
on conflict (role, module) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve;

-- Kullanıcının tüm modül yetkilerini tek seferde döndür (UI nav filtresi)
create or replace function public.fn_list_user_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.admin_role_v2;
  v_legacy_role text;
  v_result jsonb := '{}'::jsonb;
  v_row record;
  v_mod jsonb;
begin
  if auth.uid() is null then
    return '{}'::jsonb;
  end if;

  select admin_role, role::text
    into v_role, v_legacy_role
    from public.profiles
    where id = auth.uid();

  if v_legacy_role not in ('admin', 'staff') then
    return '{}'::jsonb;
  end if;

  -- Legacy: admin_role NULL → tam yetki (geriye uyumluluk)
  if v_role is null then
    return jsonb_build_object(
      'legacyFullAccess', true,
      'adminRole', null,
      'role', v_legacy_role,
      'canViewFinancials', true
    );
  end if;

  if v_role = 'super_admin' then
    return jsonb_build_object(
      'legacyFullAccess', true,
      'adminRole', v_role::text,
      'role', v_legacy_role,
      'canViewFinancials', true
    );
  end if;

  for v_row in
    select module, can_view, can_create, can_update, can_delete, can_approve
    from public.admin_role_permissions
    where role = v_role
  loop
    v_mod := jsonb_build_object(
      'view', v_row.can_view,
      'create', v_row.can_create,
      'update', v_row.can_update,
      'delete', v_row.can_delete,
      'approve', v_row.can_approve
    );
    v_result := v_result || jsonb_build_object(v_row.module, v_mod);
  end loop;

  return jsonb_build_object(
    'legacyFullAccess', false,
    'adminRole', v_role::text,
    'role', v_legacy_role,
    'canViewFinancials', coalesce((v_result->'finans'->>'view')::boolean, false),
    'permissions', v_result
  );
end;
$$;

grant execute on function public.fn_list_user_permissions() to authenticated;

comment on function public.fn_list_user_permissions is
  'Geçerli admin/staff kullanıcının modül×eylem yetki haritası. AdminShell nav filtresi için.';
