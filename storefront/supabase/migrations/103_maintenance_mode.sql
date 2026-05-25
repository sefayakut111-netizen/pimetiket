ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text DEFAULT 'Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin.';
