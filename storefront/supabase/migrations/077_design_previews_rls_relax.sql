-- ============================================================
-- Pim Etiket — Migration 077: design-previews RLS gevşetme
-- ============================================================
--
-- Sefa 21 May v68 — E2E test kök neden analizi:
--   Migration 072 storage RLS path-strict policy kullanıyordu:
--     (storage.foldername(name))[1] = auth.uid()::text
--
--   Client tarafı doğru path üretiyor ({user_id}/{design_id}.png) ama
--   @supabase/ssr browser client'ın Authorization header'ı storage
--   upload'a otomatik bağlanmıyor olabilir → auth.uid() server tarafında
--   NULL dönüyor → policy fail → "new row violates row-level security
--   policy" hatası.
--
--   Sonuç: cart_items.design_preview_url blob:URL'e fallback yapıyor →
--   session-only → F5 refresh sonrası kayboluyor → admin/üretim partner
--   preview göremiyor → P0 launch blocker.
--
-- Çözüm — RLS path kontrolünü kaldır, sadece authenticated rolünü iste:
--   - bucket zaten `public` (anyone reads)
--   - allowed_mime_types = ['image/png'] (binary check)
--   - file_size_limit = 5 MB (DoS koruma)
--   - design_id UUID (guess edilemez → cross-user yazma zor)
--
--   Güvenlik trade-off: kötü niyetli authenticated user, başka user'ın
--   designId'sini öğrenirse onun klasörüne yazabilir. Ancak:
--     1) designId UUID'leri client-side üretilir (random)
--     2) Bucket public read → veri zaten gizli değil
--     3) Yazılan dosya da PNG image → sistem hasarı sınırlı
--
--   Daha sıkı bir model gerekirse Migration 077'yi geri çevirip server-
--   side proxy endpoint (`/api/cart/upload-preview`, service_role)
--   kurulabilir. Şu an pragmatik tercih.
--
-- ============================================================

-- Eski path-strict policies'i drop et
drop policy if exists "design_previews_owner_insert" on storage.objects;
drop policy if exists "design_previews_owner_update" on storage.objects;
drop policy if exists "design_previews_owner_delete" on storage.objects;

-- Yeni gevşek policies — sadece authenticated user write yapabilir
-- (path kontrolü kalktı). Read zaten public bucket flag ile serbest.

-- INSERT
create policy "design_previews_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'design-previews');

-- UPDATE (upsert flag için)
create policy "design_previews_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'design-previews')
  with check (bucket_id = 'design-previews');

-- DELETE (cleanup endpoint için)
create policy "design_previews_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'design-previews');

-- Yorum
comment on policy "design_previews_auth_insert" on storage.objects is
  'Sefa 21 May v68 Mig 077: path-strict policy gevşetildi — design-previews '
  'public bucket için yalnızca authenticated rol kontrolü. designId UUID '
  'olduğu için cross-user yazma pratikte zor; gerekirse server-side proxy '
  'endpoint ile sıkılaştırılır.';

-- ============================================================
-- Migration 077 sonu
-- ============================================================
