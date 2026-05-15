-- ============================================================
-- Pim Etiket — Migration 038: cart_items multi-design metadata
--
-- Sefa kuralı (15 May v5): Sepete eklenen ürüne 50'ye kadar tasarım
-- yüklenebilir. design_temp_id ANA tasarım (primary, mockup için).
-- Ek tasarımlar additional_designs jsonb alanında tutulur.
--
-- Schema:
--   design_count       int   — kullanıcının seçtiği tasarım adedi (1-50)
--   additional_designs jsonb — primary hariç N-1 dosya. Her biri:
--     {tempId, previewUrl, fileName, sizeBytes, mimeType}
--
-- Ödeme sonrası order placement aşamasında bu metadata `orders` tablosuna
-- ve sonra `order_designs` (yeni) tablosuna promote edilir. Şu an SADECE
-- cart için saklanır (LocalStorage <-> DB sync).
-- ============================================================

alter table public.cart_items
  add column if not exists design_count smallint
    check (design_count is null or (design_count >= 1 and design_count <= 50)),
  add column if not exists additional_designs jsonb;

-- Comment
comment on column public.cart_items.design_count is
  'Kullanıcı belirttiği farklı tasarım adedi (1-50). Fiyat iskonto için.';

comment on column public.cart_items.additional_designs is
  'Ek tasarım dosyaları (primary hariç) JSONB array. '
  'Şema: [{tempId, previewUrl, fileName, sizeBytes, mimeType}]. '
  'Ödeme sonrası order_designs tablosuna promote edilir.';

-- ============================================================
-- Migration 038 sonu
-- ============================================================
