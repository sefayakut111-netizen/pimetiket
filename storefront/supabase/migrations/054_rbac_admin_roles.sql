-- ============================================================
-- Pim Etiket — Migration 054: Granular Admin RBAC (5 rol)
--
-- Sefa 18 May v68 (admin UX/Ops denetim P1):
-- Şu an profiles.role TEXT — 'admin' | 'staff' | 'customer' düz.
-- Tüm admin'ler her şeyi yapabiliyor. Persona ayrımı yok:
--   - Müşteri Hizmetleri iadeyi onaylar ama fiyat motoruna dokunmaz
--   - Üretim siparişe atar ama müşteri silmez
--   - İçerik editörü blog yazar ama finans görmez
--
-- ÇÖZÜM: 5 sabit rol + modül×eylem yetki matrisi.
-- profiles.role TEXT olarak kalıyor (geriye uyumluluk). Ek admin_role
-- granular set sub-set olarak çalışıyor.
-- ============================================================

-- 1. ENUM: admin_role
do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_role_v2') then
    create type public.admin_role_v2 as enum (
      'super_admin',      -- Tam yetki (Sefa)
      'operations',       -- Sipariş + fason + üretim
      'customer_service', -- Müşteri + iade + yorumlar + KVKK
      'production',       -- AI QC + prova + tasarımlar + kargo
      'content_editor'    -- Blog + galeri + site görselleri + aboneler
    );
  end if;
end$$;

-- 2. profiles tablosuna admin_role kolon
alter table public.profiles
  add column if not exists admin_role public.admin_role_v2;

comment on column public.profiles.admin_role is
  'Granular admin role (5 enum). NULL ise eski profiles.role kullanılır (geriye uyumluluk). super_admin tam yetki, diğerleri yetki matrisine göre kısıtlı.';

-- 3. Yetki matrisi reference tablosu
create table if not exists public.admin_role_permissions (
  role public.admin_role_v2 not null,
  module text not null,
  -- Eylem: view | create | update | delete | approve
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  primary key (role, module)
);

-- 4. Default matris (her rol için)
insert into public.admin_role_permissions
  (role, module, can_view, can_create, can_update, can_delete, can_approve)
values
  -- SUPER ADMIN — her şey
  ('super_admin', '*', true, true, true, true, true),

  -- OPERATIONS — sipariş + fason + finans (read) + kargo
  ('operations', 'orders', true, true, true, false, true),
  ('operations', 'fason', true, true, true, true, true),
  ('operations', 'shipments', true, true, true, false, true),
  ('operations', 'manual_order', true, true, false, false, false),
  ('operations', 'reports', true, false, false, false, false),
  ('operations', 'finans', true, false, false, false, false),

  -- CUSTOMER SERVICE — müşteri + iade + yorumlar + KVKK
  ('customer_service', 'customers', true, true, true, false, false),
  ('customer_service', 'returns', true, true, true, false, true),
  ('customer_service', 'reviews', true, false, true, true, true),
  ('customer_service', 'kvkk', true, true, true, false, true),
  ('customer_service', 'orders', true, false, false, false, false),

  -- PRODUCTION — AI QC + prova + tasarımlar + kargo
  ('production', 'ai_qc', true, false, true, false, true),
  ('production', 'proof', true, false, true, false, true),
  ('production', 'designs', true, false, true, false, false),
  ('production', 'orders', true, false, true, false, false),
  ('production', 'shipments', true, true, true, false, false),

  -- CONTENT EDITOR — blog + galeri + görseller + aboneler
  ('content_editor', 'blog', true, true, true, true, false),
  ('content_editor', 'gallery', true, true, true, true, false),
  ('content_editor', 'site_images', true, true, true, true, false),
  ('content_editor', 'subscribers', true, false, false, false, false)
on conflict (role, module) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve;

-- 5. RPC: yetki kontrolü
create or replace function public.fn_has_permission(
  p_module text,
  p_action text  -- 'view' | 'create' | 'update' | 'delete' | 'approve'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.admin_role_v2;
  v_legacy_role text;
  v_can boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select admin_role, role
    into v_role, v_legacy_role
    from public.profiles
    where id = auth.uid();

  -- Geriye uyumluluk: admin_role NULL ama eski role='admin'|'staff'
  -- → super_admin gibi davran (Sefa migration sonrası kademeli geçecek)
  if v_role is null then
    return v_legacy_role in ('admin', 'staff');
  end if;

  -- Super admin tüm modüllerde yetkili
  if v_role = 'super_admin' then
    return true;
  end if;

  -- Modül için yetki kontrolü
  select case p_action
      when 'view' then can_view
      when 'create' then can_create
      when 'update' then can_update
      when 'delete' then can_delete
      when 'approve' then can_approve
      else false
    end
    into v_can
    from public.admin_role_permissions
    where role = v_role
      and (module = p_module or module = '*')
    order by (module = p_module) desc
    limit 1;

  return coalesce(v_can, false);
end;
$$;

grant execute on function public.fn_has_permission(text, text) to authenticated;

-- 6. RPC: rol listesi (admin UI dropdown için)
create or replace function public.fn_list_admin_roles()
returns table (
  role public.admin_role_v2,
  label text,
  description text
)
language sql
stable
as $$
  select * from (values
    ('super_admin'::public.admin_role_v2, 'Süper Admin', 'Tam yetki — Sefa'),
    ('operations'::public.admin_role_v2, 'Operasyon', 'Sipariş + fason + kargo + finans (sadece görüntüleme)'),
    ('customer_service'::public.admin_role_v2, 'Müşteri Hizmetleri', 'Müşteri + iade + yorumlar + KVKK'),
    ('production'::public.admin_role_v2, 'Üretim', 'AI QC + prova + tasarımlar + kargo bilgisi girme'),
    ('content_editor'::public.admin_role_v2, 'İçerik Editörü', 'Blog + galeri + site görselleri + abone listesi')
  ) as t (role, label, description);
$$;

grant execute on function public.fn_list_admin_roles() to authenticated;

comment on function public.fn_has_permission is
  'Geçerli auth kullanıcısı belirli modülde belirli eylemi yapabilir mi? API endpoint guard''larında kullanılır.';
comment on function public.fn_list_admin_roles is
  'Admin UI için rol listesi (label + açıklama). /admin/calisanlar formunda dropdown için.';
