-- Migration 119: Finans preset rolü + operasyon preset hizalama (Faz 4 RBAC UI)

ALTER TYPE public.admin_role_v2 ADD VALUE IF NOT EXISTS 'finance';

INSERT INTO public.admin_role_permissions
  (role, module, can_view, can_create, can_update, can_delete, can_approve)
VALUES
  -- FINANS preset
  ('finance', 'dashboard', true, false, false, false, false),
  ('finance', 'finans', true, true, true, false, false),
  ('finance', 'coupons', true, true, true, true, false),
  ('finance', 'pricing', true, true, true, false, false),
  ('finance', 'reports', true, false, false, false, false),
  ('finance', 'orders', true, false, false, false, false),
  ('finance', 'manual_order', true, false, false, false, false),
  ('finance', 'ai_qc', true, false, false, false, false),
  ('finance', 'proof', true, false, false, false, false),
  ('finance', 'shipments', true, false, false, false, false),
  ('finance', 'fason', true, false, false, false, false),
  ('finance', 'customers', true, false, false, false, false),
  ('finance', 'returns', true, false, false, false, false),
  ('finance', 'reviews', true, false, false, false, false),
  ('finance', 'designs', true, false, false, false, false),
  ('finance', 'help_requests', true, false, false, false, false),
  ('finance', 'products', true, false, false, false, false),
  ('finance', 'audit_log', true, false, false, false, false),

  -- OPERATÖR preset — operations rolünü genişlet
  ('operations', 'ai_qc', true, false, true, false, true),
  ('operations', 'proof', true, false, true, false, true),
  ('operations', 'customers', true, false, false, false, false),
  ('operations', 'returns', true, true, true, false, true),
  ('operations', 'designs', true, false, true, false, false)
ON CONFLICT (role, module) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete,
  can_approve = EXCLUDED.can_approve;

CREATE OR REPLACE FUNCTION public.fn_list_admin_roles()
RETURNS TABLE (
  role public.admin_role_v2,
  label text,
  description text
)
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM (VALUES
    ('super_admin'::public.admin_role_v2, 'Admin (tam yetki)', 'Tüm modüller — preset: Admin'),
    ('operations'::public.admin_role_v2, 'Operatör', 'Operasyon hattı — preset: Operatör'),
    ('finance'::public.admin_role_v2, 'Finans', 'Finans + rapor — preset: Finans'),
    ('customer_service'::public.admin_role_v2, 'Müşteri Hizmetleri (legacy)', 'Eski rol — preset ile değiştirin'),
    ('production'::public.admin_role_v2, 'Üretim (legacy)', 'Eski rol — preset ile değiştirin'),
    ('content_editor'::public.admin_role_v2, 'İçerik Editörü (legacy)', 'Eski rol — preset ile değiştirin')
  ) AS t (role, label, description);
$$;
