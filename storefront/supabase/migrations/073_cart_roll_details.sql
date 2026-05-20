-- Migration 073 · cart_items rulo detayları (Sefa 21 May v68)
--
-- Sorun: Etiket konfigüratör rulo modunda göbek çapı (coreSize: 25/40/76mm)
-- ve rulo başına etiket adedi (rollLabelCount) sadece cart_items.config
-- string'inde tutuluyordu. Sipariş detayı sayfasında "İşlem özeti" göstermek
-- için yapılandırılmış (structured) veri gerek.
--
-- Çözüm: 2 nullable kolon — geri uyumlu, mevcut satırları etkilemez.
-- buildSummaryItems helper (src/lib/order-summary.ts) bu kolonları okur,
-- konfigüratör PriceCard + /siparis detay + /panelim aynı format.

alter table public.cart_items
  add column if not exists core_size integer,
  add column if not exists roll_label_count integer;

comment on column public.cart_items.core_size is
  'Rulo göbek (iç) çapı mm (25, 40, 76). Sadece etiket+rulo formatında dolu.';
comment on column public.cart_items.roll_label_count is
  '1 rulodaki etiket sayısı (rulodaki adet). Sadece etiket+rulo formatında dolu.';
