-- Migration 113: Operasyon rolunden finans yetkisini kaldir (KVKK need-to-know)

DELETE FROM public.admin_role_permissions
WHERE role = 'operations'::public.admin_role_v2
  AND module = 'finans';

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
    ('super_admin'::public.admin_role_v2, 'Süper Admin', 'Tam yetki — Sefa'),
    ('operations'::public.admin_role_v2, 'Operasyon', 'Sipariş + fason + kargo'),
    ('customer_service'::public.admin_role_v2, 'Müşteri Hizmetleri', 'Müşteri + iade + yorumlar + KVKK'),
    ('production'::public.admin_role_v2, 'Üretim', 'AI QC + prova + tasarımlar + kargo bilgisi girme'),
    ('content_editor'::public.admin_role_v2, 'İçerik Editörü', 'Blog + galeri + site görselleri + abone listesi')
  ) AS t (role, label, description);
$$;
