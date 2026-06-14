-- Mig 192: Teslim süresi 3-ürün modeli (denetim #5) — tabaka + rulo ayrı, İŞ GÜNÜ
--
-- Mig 173 sticker_delivery_days(5) + etiket_delivery_days(10) eklemişti ("takvim günü",
-- tek 'etiket' kovası). Sefa kararı (14 Haz): (1) tek-kaynak, (2) sticker 3 / tabaka 5 /
-- rulo 10, (3) ÜRETİM İŞ GÜNÜ (resmi tatil hariç). Kod katmanı (Commit 2) checkout
-- estimatedDelivery hesabını addBusinessDays'e geçirir; bu kolonlar artık ÜRETİM
-- İŞ GÜNÜ'nü (tasarım onayı → kargoya verme) tutar ve src/lib/pim/site-facts.ts
-- PIM_PRODUCTION_BUSINESS_DAYS ile SENKRON tutulmalıdır (admin /ayarlar override eder).

alter table public.site_settings
  add column if not exists tabaka_delivery_days integer not null default 5,
  add column if not exists rulo_delivery_days integer not null default 10;

comment on column public.site_settings.sticker_delivery_days is
  'Sticker üretim iş günü (tasarım onayı→kargoya verme; site-facts ile senkron: 3)';
comment on column public.site_settings.etiket_delivery_days is
  'LEGACY/geri-uyum — etiket için en uzun süre (=rulo). Yeni kod tabaka/rulo kolonlarını kullanır.';
comment on column public.site_settings.tabaka_delivery_days is
  'Tabaka etiket üretim iş günü (tasarım onayı→kargoya verme; site-facts ile senkron: 5)';
comment on column public.site_settings.rulo_delivery_days is
  'Rulo etiket üretim iş günü (tasarım onayı→kargoya verme; site-facts ile senkron: 10)';

-- Mevcut singleton satırı kanonik 3-ürün modeline hizala (Mig 173 default'ları
-- yanlış 5/takvim idi). Idempotent — tekrar çalışması güvenli.
update public.site_settings
set sticker_delivery_days = 3,
    tabaka_delivery_days = 5,
    rulo_delivery_days = 10,
    etiket_delivery_days = 10;
