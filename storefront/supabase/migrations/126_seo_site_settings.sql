-- SEO alanları: sosyal profiller (Organization sameAs) + schema telefon
alter table public.site_settings
  add column if not exists social_links text,
  add column if not exists seo_contact_phone varchar(32);

comment on column public.site_settings.social_links is
  'Virgülle ayrılmış HTTPS sosyal profil URL listesi (Organization sameAs)';
comment on column public.site_settings.seo_contact_phone is
  'Schema.org contactPoint telefon (+90 formatı önerilir)';
