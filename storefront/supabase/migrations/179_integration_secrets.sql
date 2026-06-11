-- Gizli entegrasyon anahtarları (Instagram token vb.)
-- site_settings / public API üzerinden SIZMAZ — yalnız service-role erişir.

create table if not exists public.integration_secrets (
  key text primary key,
  value text not null,
  expires_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;

-- authenticated / anon için policy YOK → erişim engelli (service-role bypass)

comment on table public.integration_secrets is
  'Gizli entegrasyon değerleri — Instagram access token vb. Yalnız service-role API.';

comment on column public.integration_secrets.expires_at is
  'Token geçerlilik sonu (Instagram refresh expires_in hesabı).';
