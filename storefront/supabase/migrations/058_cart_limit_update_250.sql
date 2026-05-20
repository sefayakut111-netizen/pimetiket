-- Pim Etiket — Migration 058: min/max sipariş tutarı 100/100K → 250/250K
-- Sefa 19 May v68: yeni limit değerleri.

update public.site_settings
set min_order_total_try = 250.00,
    max_order_total_try = 250000.00
where id = 1;

-- Default değerlerini de güncelle (yeni install için)
alter table public.site_settings
  alter column min_order_total_try set default 250.00,
  alter column max_order_total_try set default 250000.00;

comment on column public.site_settings.min_order_total_try is
  'Minimum sipariş tutarı (₺, KDV dahil). Default 250 ₺ (Sefa 19 May).';
comment on column public.site_settings.max_order_total_try is
  'Maksimum sipariş tutarı (₺, KDV dahil). Default 250.000 ₺ (Sefa 19 May).';
