-- ============================================================
-- Pim Etiket — Migration 036: Site Image Management (slot-based)
--
-- Sefa kararı 13 May: anasayfa hero / sablonlar hero / OG image /
-- product cards görsel'leri admin panelinden yönetilebilsin.
-- "Galeri" zaten ayrı bir konsept (showcase galerisi, yazılı içerikli);
-- bu tablo SLOT-BAZLI sabit görsel slot'larını yönetir.
--
-- Slot örnekleri (kod tarafında catalog'da liste):
--   home_hero, home_etiket_card, home_sticker_card, og_default,
--   sablonlar_hero, blog_default_hero, auth_hero
--
-- Storage: public-assets bucket içinde `site-images/{slot}/...`
-- her slot için MAX 1 görsel (replace pattern).
--
-- RLS: public SELECT (herkes okur, anasayfada gösterilir).
--      INSERT/UPDATE/DELETE sadece admin/staff.
-- ============================================================

create table if not exists public.site_images (
  id uuid primary key default gen_random_uuid(),
  -- Slot adı — kod tarafındaki catalog ile birebir eşleşir
  slot text unique not null
    check (slot ~ '^[a-z][a-z0-9_]{2,40}$'),
  -- Storage path (public-assets bucket içinde)
  storage_path text not null,
  -- Yardımcı meta (accessibility + SEO için)
  alt_text text,
  title text,
  -- Opsiyonel: görsel tıklanabilir olsun mu, nereye gitsin
  link_url text,
  -- Görünür/gizli (slot'u koruyup geçici devre dışı bırakma)
  is_active boolean not null default true,
  -- İçerik meta (lazy load + responsive için)
  width integer,
  height integer,
  size_bytes integer,
  mime_type text
    check (
      mime_type is null
      or mime_type in (
        'image/jpeg', 'image/png', 'image/webp',
        'image/avif', 'image/svg+xml'
      )
    ),
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists site_images_slot_idx
  on public.site_images(slot)
  where is_active = true;

-- updated_at trigger
create or replace function public.fn_site_images_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_site_images_touch on public.site_images;
create trigger trg_site_images_touch
before update on public.site_images
for each row execute function public.fn_site_images_touch();

-- ============================================================
-- RLS
-- ============================================================
alter table public.site_images enable row level security;

-- SELECT: aktif görsel'leri herkes okuyabilir (public site için)
drop policy if exists site_images_select_public on public.site_images;
create policy site_images_select_public
  on public.site_images
  for select
  using (is_active = true);

-- INSERT/UPDATE/DELETE: sadece admin/staff
drop policy if exists site_images_admin_insert on public.site_images;
create policy site_images_admin_insert
  on public.site_images
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

drop policy if exists site_images_admin_update on public.site_images;
create policy site_images_admin_update
  on public.site_images
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

drop policy if exists site_images_admin_delete on public.site_images;
create policy site_images_admin_delete
  on public.site_images
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

comment on table public.site_images is
  'Slot-bazlı site görselleri (anasayfa hero, OG, sablonlar hero, vs). '
  'Kod tarafındaki catalog (lib/site-image-slots.ts) ile birebir eşleşir. '
  'Storage: public-assets bucket içinde site-images/{slot}/... path.';

-- ============================================================
-- Migration 036 sonu
-- ============================================================
