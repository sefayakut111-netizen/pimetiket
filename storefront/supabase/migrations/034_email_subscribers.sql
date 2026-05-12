-- ============================================================
-- Pim Etiket — Migration 034: Email Subscriber Listesi
--
-- Lead magnet "Ücretsiz Şablonlar" sayfası için email signup.
-- Çerez izninden BAĞIMSIZ — kullanıcı kendi iradesiyle email
-- bırakıyor (explicit consent). KVKK m.5/1/a "açık rıza" karşılığı.
--
-- Resend mail otomasyonu aktif olunca:
--   - signup → welcome mail + ZIP linki
--   - 14 gün sonra → ilk-sipariş %15 kupon maili
--   - 30 gün sonra → "yeni şablonlar" bülten maili
--
-- KVKK silme talebi (m.11/e): subscribed = false + deleted_at timestamp.
-- ============================================================

create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Kayıt kaynağı: hangi sayfa/kampanya'dan geldi
  source text not null default 'sablonlar'
    check (source in (
      'sablonlar',         -- /sablonlar lead magnet
      'newsletter',        -- Footer bülten formu
      'order_complete',    -- Sipariş sonrası "haberdar olmak ister misin"
      'gated_download',    -- Diğer indirilebilir içerikler
      'manual_import'      -- Sefa manuel ekledi
    )),
  -- Hangi şablon kategorilerine ilgi var (multi-select için array)
  interests text[] not null default '{}',
  -- KVKK m.10 aydınlatma onayı timestamp + IP + UA
  consent_at timestamptz not null default now(),
  consent_ip inet,
  consent_ua text,
  -- Resend mail durumu — abone listesi yönetimi
  subscribed boolean not null default true,
  unsubscribed_at timestamptz,
  -- Welcome mail durumu
  welcome_sent_at timestamptz,
  -- KVKK silme — soft delete (audit izi kalsın)
  deleted_at timestamptz,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Aynı email birden fazla kaynaktan gelebilir → en yenisi güncellenir
  -- UNIQUE constraint: deleted_at IS NULL olanlar arasında email unique
  constraint email_subscribers_email_check check (
    email = lower(email) and length(email) >= 5
  )
);

-- Aktif (silinmemiş) email'ler arasında unique
create unique index if not exists email_subscribers_email_unique_active
  on public.email_subscribers (email)
  where deleted_at is null;

-- Resend cron için index (henüz welcome maili gönderilmemiş aktif aboneler)
create index if not exists email_subscribers_pending_welcome
  on public.email_subscribers (created_at)
  where welcome_sent_at is null and subscribed = true and deleted_at is null;

-- Source breakdown raporu için
create index if not exists email_subscribers_source_idx
  on public.email_subscribers (source, created_at desc);

-- updated_at trigger
create or replace function public.fn_email_subscribers_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_email_subscribers_touch on public.email_subscribers;
create trigger trg_email_subscribers_touch
before update on public.email_subscribers
for each row execute function public.fn_email_subscribers_touch();

-- ============================================================
-- RLS — sadece admin/staff okur, anonymous INSERT yapabilir
-- (public form'dan signup gelmeli)
-- ============================================================
alter table public.email_subscribers enable row level security;

-- INSERT: herkese açık (public form için)
drop policy if exists email_subscribers_insert_public on public.email_subscribers;
create policy email_subscribers_insert_public
  on public.email_subscribers
  for insert
  with check (true);

-- SELECT: sadece admin/staff
drop policy if exists email_subscribers_select_admin on public.email_subscribers;
create policy email_subscribers_select_admin
  on public.email_subscribers
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

-- UPDATE: sadece admin/staff
drop policy if exists email_subscribers_update_admin on public.email_subscribers;
create policy email_subscribers_update_admin
  on public.email_subscribers
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

-- DELETE: yasak (sadece service_role)
-- KVKK silme talebi soft-delete ile yapılır (deleted_at).

comment on table public.email_subscribers is
  'Lead magnet + bülten email listesi. KVKK m.5/1/a explicit consent. '
  'Silme talebi soft-delete (deleted_at). Welcome + kampanya mailları '
  'Resend aktifleştiğinde otomatikleşir.';

-- ============================================================
-- Migration 034 sonu
-- ============================================================
