-- ============================================================
-- Pim Etiket — Migration 053: Sepet min/max sipariş tutarı
--
-- Sefa 18 May v68 (CRO denetim sonrası):
-- Site geneli minimum ve maksimum sipariş tutarı limit'i. /admin/ayarlar'dan
-- değiştirilebilir. Sepet sayfası bu değerleri okuyup uyarı verir:
--   - subtotal < min_order_total_try → "X ₺ daha ekle, min sipariş Y ₺"
--   - subtotal > max_order_total_try → "WhatsApp ile toplu sipariş anlaşması"
--
-- Default: min 100 ₺, max 100.000 ₺ (Sefa /admin/ayarlar'dan değiştirir).
-- ============================================================

alter table public.site_settings
  add column if not exists min_order_total_try numeric(10, 2)
    not null default 100.00,
  add column if not exists max_order_total_try numeric(10, 2)
    not null default 100000.00;

comment on column public.site_settings.min_order_total_try is
  'Minimum sipariş tutarı (₺, KDV dahil). Sepet bu değerin altındaysa ödeme açılmaz, kullanıcıya "X ₺ daha ekle" uyarısı gösterilir.';
comment on column public.site_settings.max_order_total_try is
  'Maksimum sipariş tutarı (₺, KDV dahil). Üzerindeyse "toplu sipariş için WhatsApp" yönlendirmesi yapılır.';
