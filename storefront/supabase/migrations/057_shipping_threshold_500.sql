-- Pim Etiket — Migration 057: free_shipping_threshold 1000 → 500
-- Sefa 18 May v68 (senkronizasyon denetimi):
-- Pim AI KB + /sss + anasayfa hepsi 500 ₺ diyordu ama DB default 1000'di.
-- Eğer site_settings'te admin tarafından değiştirilmemişse, default'u 500'e çek.

update public.site_settings
set free_shipping_threshold = 500
where id = 1
  and free_shipping_threshold = 1000;

-- Default değerini de güncelle (yeni install için)
alter table public.site_settings
  alter column free_shipping_threshold set default 500;
