-- ============================================================
-- Pim Etiket — Migration 006
--
-- Supabase Storage bucket'ları + RLS politikaları.
--
-- Bucket'lar:
--   designs       → Müşteri tasarım dosyaları (PDF, AI, EPS, PSD, PNG, JPG, SVG)
--                   Path pattern: designs/<order_id>/<file_uuid>.<ext>
--                   Müşteri sadece kendi sipariş klasörüne yazabilir.
--   return-photos → İade talebi görselleri (sadece JPG/PNG)
--                   Path pattern: return-photos/<return_id>/<photo_uuid>.<ext>
--   reviews-photos → Yorum görselleri (gelecek faz, opsiyonel)
--   public-assets → Footer/blog/banner görselleri (admin yükler, public okur)
--
-- NOT: Storage bucket'ları SQL ile değil Supabase Dashboard'dan veya
-- Storage API ile oluşturulur. Bu migration sadece RLS politikalarını
-- yazar. Bucket'lar manuel oluşturulduktan sonra policy'ler aktif olur.
--
-- Bucket OLUŞTURMA — Supabase Dashboard:
--   Storage → New bucket → public off → file size limit 30 MB →
--   allowed mime types: application/pdf, image/png, image/jpeg, image/svg+xml,
--   application/illustrator, application/postscript, image/vnd.adobe.photoshop
-- ============================================================

-- storage.objects tablosunda RLS zaten enabled (Supabase default).
-- Sadece policy'leri ekliyoruz.

-- ---------- designs bucket ----------
-- INSERT: Müşteri sadece kendi siparişine yükleyebilir
-- Path: designs/<order_id>/<file>
-- Kontrol: order_id müşteriye ait mi?
drop policy if exists "Users can upload to own orders" on storage.objects;
create policy "Users can upload to own orders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] in (
      select id from public.orders where user_id = auth.uid()
    )
  );

-- SELECT: Müşteri sadece kendi tasarım dosyalarını okuyabilir
drop policy if exists "Users can read own designs" on storage.objects;
create policy "Users can read own designs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] in (
      select id from public.orders where user_id = auth.uid()
    )
  );

-- DELETE: Müşteri sadece pending status'undeki dosyayı silebilir
-- (design_files.status kontrolü)
drop policy if exists "Users can delete own pending designs" on storage.objects;
create policy "Users can delete own pending designs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'designs'
    and exists (
      select 1 from public.design_files df
      where df.storage_path = name
        and df.user_id = auth.uid()
        and df.status in ('uploaded', 'qc_failed')
    )
  );

-- ---------- return-photos bucket ----------
drop policy if exists "Users can upload return photos" on storage.objects;
create policy "Users can upload return photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.returns where user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own return photos" on storage.objects;
create policy "Users can read own return photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.returns where user_id = auth.uid()
    )
  );

-- ---------- public-assets bucket ----------
-- Admin yükler (service_role), herkes okur
drop policy if exists "Anyone can read public assets" on storage.objects;
create policy "Anyone can read public assets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public-assets');

-- INSERT/UPDATE/DELETE sadece service_role (admin)
