-- Migration 072 · cart_items design preview kolonları (Sefa 20 May v68)
--
-- Sorun: Müşteri konfigüratörde PSD/AI/PDF yüklediğinde sepette gerçek
-- önizleme yok — generic Sticker/Etiket ikonu görünüyor. Sebep:
-- cart_items tablosunda preview URL alanı yoktu.
--
-- Çözüm: Client-side render (pdfjs-dist + ag-psd) ile preview PNG üret,
-- Supabase Storage'a yükle, URL'i cart_items'a kaydet. Sepet UI'da bu
-- URL ile <img> göster; preview üretilemezse PDF/AI/PSD logo rozeti
-- fallback.
--
-- 3 nullable kolon — geri uyumlu, mevcut cart_items satırlarını etkilemez.
-- additional_designs JSONB zaten benzer alanları taşır (multi-design için);
-- bu kolonlar ANA tasarım (designs[0]) için.

alter table public.cart_items
  add column if not exists design_preview_url text,
  add column if not exists design_file_name text,
  add column if not exists design_mime_type text;

comment on column public.cart_items.design_preview_url is
  'Ana tasarımın preview PNG URL (Supabase Storage signed). Konfigüratörde client-side render edilir (pdfjs-dist PDF/AI, ag-psd PSD, native PNG/JPG/SVG). NULL ise sepet UI fallback logo gösterir.';
comment on column public.cart_items.design_file_name is
  'Orijinal dosya adı (örn. "marka-logo.pdf"). Sepet UI''da chip''te gösterilir, debug için.';
comment on column public.cart_items.design_mime_type is
  'Orijinal MIME (application/pdf, image/vnd.adobe.photoshop, application/illustrator, image/png, image/jpeg, image/svg+xml). Preview üretilemediyse fallback logo seçimi için.';

-- ============================================================
-- Storage bucket · design-previews (public read, auth write)
-- ============================================================
-- Sefa 20 May v68: Preview PNG'leri burada saklanır. Public read çünkü
-- sepet/odeme/admin UI <img> ile gösterir; write sadece auth + owner path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-previews',
  'design-previews',
  true,
  5242880, -- 5 MB max (PNG preview küçük olur, 600px max width)
  array['image/png']
)
on conflict (id) do nothing;

-- RLS — herkesin okuyabilmesi public flag ile sağlanır (storage.objects
-- üzerinde owner check standart politika).

-- Insert · sadece owner kendi klasörüne yazabilir
-- Path schema: {user_id}/{design_id}.png
drop policy if exists "design_previews_owner_insert" on storage.objects;
create policy "design_previews_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'design-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update (upsert) · sadece owner
drop policy if exists "design_previews_owner_update" on storage.objects;
create policy "design_previews_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'design-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete · sadece owner (retention/cleanup için)
drop policy if exists "design_previews_owner_delete" on storage.objects;
create policy "design_previews_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'design-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read · public bucket olduğu için anon + authenticated read serbest.
-- Bucket.public=true → otomatik. Ek policy gerekmez.
