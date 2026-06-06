-- Mig 173: Teslim günleri + WhatsApp — admin ayarlar → site_settings (gerçek etki)
alter table public.site_settings
  add column if not exists sticker_delivery_days integer not null default 5,
  add column if not exists etiket_delivery_days integer not null default 10,
  add column if not exists contact_whatsapp varchar(32);

comment on column public.site_settings.sticker_delivery_days is
  'Tahmini üretim+teslim takvim günü (sticker siparişleri)';
comment on column public.site_settings.etiket_delivery_days is
  'Tahmini üretim+teslim takvim günü (etiket siparişleri)';
comment on column public.site_settings.contact_whatsapp is
  'Footer WhatsApp hattı (+90 formatı önerilir)';
