-- ============================================================
-- Pim Etiket — Migration 029: site_settings tablosu
--
-- Admin /admin/ayarlar üzerinden değiştirilen runtime config'ler.
-- Şu an:
--   - shipping_fee_try          : Standart kargo bedeli (₺)
--   - free_shipping_threshold   : Üzerinde ücretsiz kargo eşiği (₺)
--   - welcome_credit_try        : Yeni üye hoşgeldin çeki (₺)
--   - referral_credit_try       : Referans tamamlanınca çek (₺)
--   - min_subtotal_for_credit   : Hediye çekleri min sepet (₺)
--
-- Sefa kuralı: tüm bu değerler /admin/ayarlar form'undan değiştirilebilir.
-- Singleton row (id=1) — birden fazla satır olmasın.
-- ============================================================

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  shipping_fee_try numeric(10, 2) not null default 49.00,
  free_shipping_threshold numeric(10, 2) not null default 1000.00,
  welcome_credit_try numeric(10, 2) not null default 250.00,
  referral_credit_try numeric(10, 2) not null default 250.00,
  min_subtotal_for_credit numeric(10, 2) not null default 500.00,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- İlk satırı oluştur (idempotent)
insert into public.site_settings (id)
  values (1)
  on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Herkes okuyabilir (anasayfa kargo eşiği gösterimi için)
drop policy if exists "Anyone can read site_settings" on public.site_settings;
create policy "Anyone can read site_settings"
  on public.site_settings for select
  using (true);

-- Sadece admin/staff güncelleyebilir (UPDATE service_role bypass ile)
-- Müşteri UPDATE/DELETE/INSERT yapamaz.

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- Migration 029 sonu
-- ============================================================
