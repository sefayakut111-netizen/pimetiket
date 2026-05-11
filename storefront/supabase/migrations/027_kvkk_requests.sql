-- ============================================================
-- Pim Etiket — Migration 027: KVKK Talepleri Tablosu
--
-- KVKK m.11 ilgili kişi hakları audit trail'i:
--   - Hesap silme talebi (cascade 48 saat içinde işlem)
--   - Verilerimi indir talebi (KVKK m.11/g — ZIP export)
--   - İtiraz talebi (m.11/h — otomatik karar verme)
--   - Sınırlandırma (m.11/d-e düzeltme/silme)
--
-- Yasal yükümlülük: KVKK m.13/2 — talep en geç 30 gün içinde
-- sonuçlandırılır. Sefa standardı: 48 saat (platform içi, fason hariç).
--
-- Müşteri /ayarlar/verilerim sayfasından talep oluşturur, admin
-- /admin/kvkk-talepleri sayfasından takip eder.
-- ============================================================

-- ---------- kvkk_request_kind enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kvkk_request_kind') then
    create type public.kvkk_request_kind as enum (
      'data_export',      -- Verilerimi indir (m.11/g)
      'account_delete',   -- Hesabımı tamamen sil
      'partial_delete',   -- Granular: yorum/profil/tasarım vs ayrı sil
      'correction',       -- m.11/d düzeltme
      'objection',        -- m.11/h itiraz
      'restriction'       -- m.11/e işlemenin sınırlandırılması
    );
  end if;
end$$;

-- ---------- kvkk_request_status enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kvkk_request_status') then
    create type public.kvkk_request_status as enum (
      'pending',          -- Talep oluştu, müşteri email confirm bekliyor
      'confirmed',        -- Email tıklandı, grace period başladı
      'cancelled',        -- Müşteri 48h içinde vazgeçti
      'processing',       -- Admin işliyor
      'completed',        -- Tamamlandı
      'rejected'          -- Reddedildi (örn yasal saklama engelliyor)
    );
  end if;
end$$;

-- ---------- kvkk_requests tablosu ----------
create table if not exists public.kvkk_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.kvkk_request_kind not null,
  status public.kvkk_request_status not null default 'pending',
  -- Granular silme için (partial_delete): hangi alanlar?
  -- { orders: true, designs: true, pim_chat: false, reviews: false, profile: false }
  scope jsonb not null default '{}'::jsonb,
  -- Müşteri açıklaması
  user_note text,
  -- Email confirmation token (data_export + account_delete için)
  confirm_token text unique,
  confirm_expires_at timestamptz,
  confirmed_at timestamptz,
  -- 48 saat grace period — bu zamandan önce müşteri vazgeçebilir
  grace_period_until timestamptz,
  cancelled_at timestamptz,
  -- Admin işlem alanları
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  admin_note text,
  -- Sonuç (örn data_export için Storage path)
  result_path text,
  -- Audit
  request_ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kvkk_requests_user_idx
  on public.kvkk_requests(user_id, created_at desc);
create index if not exists kvkk_requests_status_idx
  on public.kvkk_requests(status, created_at desc);
create index if not exists kvkk_requests_confirm_token_idx
  on public.kvkk_requests(confirm_token)
  where confirm_token is not null and status = 'pending';
create index if not exists kvkk_requests_grace_idx
  on public.kvkk_requests(grace_period_until)
  where status = 'confirmed';

alter table public.kvkk_requests enable row level security;

-- Müşteri sadece kendi taleplerini görür
drop policy if exists "Users can view own kvkk requests" on public.kvkk_requests;
create policy "Users can view own kvkk requests"
  on public.kvkk_requests for select
  using (auth.uid() = user_id);

-- INSERT sadece service_role (server-side endpoint email confirm flow başlatır)
-- UPDATE sadece service_role (admin + grace cancel)

drop trigger if exists kvkk_requests_updated_at on public.kvkk_requests;
create trigger kvkk_requests_updated_at
  before update on public.kvkk_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- Migration 027 sonu
-- ============================================================
