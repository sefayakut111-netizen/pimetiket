-- ============================================================
-- Migration 083 — Partner Auth Role
-- Sefa 23 May v68
-- ============================================================
-- Amaç: Üretim partnerlerinin email + OTP ile login olabilmesi için:
--   1) partner_contacts kayıtlarını auth.users'a bağla (user_id FK)
--   2) profiles.role'e 'partner' değerini destekle (CHECK varsa güncelle)
--   3) Case-insensitive email lookup için index
--
-- Önceki durum (Mig 067):
--   partner_contacts.role = 'owner'|'operator'|'accounting' (kontak rolü)
--   partner_contacts.email var ama auth bağlantısı YOK
--   /fason/[token] sayfası magic-link tabanlı, oturum tutmuyor
--
-- Yeni akış:
--   - Partner /partner/giris'te email girer
--   - Backend partner_contacts'ta email kontrolü
--   - Bağlı auth.users yoksa otomatik oluşturulur + partner_contacts.user_id update
--   - Supabase signInWithOtp 6 haneli kod gönderir
--   - Verify → session başlar → /partner dashboard
--
-- Güvenlik:
--   - user_id ON DELETE SET NULL (auth.users silinirse partner_contacts kalır,
--     re-link mümkün olur)
--   - profiles.role 'partner' eklenince admin/staff/customer ile aynı
--     anti-impersonation kuralları geçerli (middleware /admin'i bloke eder)
--   - RLS: Faz 2'de profile + partner_contacts üzerinden satır seviyesi
-- ============================================================

-- 1) partner_contacts.user_id — auth.users link (nullable: ilk login öncesi)
alter table public.partner_contacts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists partner_contacts_user_id_idx
  on public.partner_contacts(user_id)
  where user_id is not null;

-- Case-insensitive email lookup (OTP request endpoint'i için kritik)
create index if not exists partner_contacts_email_lower_idx
  on public.partner_contacts(lower(email));

-- 2) user_role ENUM tipine 'partner' değeri ekle
-- profiles.role aslında PostgreSQL ENUM (user_role) — CHECK constraint değil.
-- ALTER TYPE ADD VALUE Postgres 12+'da transaction içinde çalışır ama
-- subsequent statement aynı tx'te yeni value'yu kullanamaz. Burada sadece
-- enum genişletmesi var, sonradan kullanan kod var değil — güvenli.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.user_role'::regtype
      and enumlabel = 'partner'
  ) then
    alter type public.user_role add value 'partner';
  end if;
end$$;

-- 3) Audit kolaylığı: partner_contacts'a son login zamanı (opsiyonel ama UI'da yararlı)
alter table public.partner_contacts
  add column if not exists last_login_at timestamptz;

-- ============================================================
-- Migration sonu
-- ============================================================
-- Rollback (acil durum):
--   alter table public.partner_contacts drop column if exists user_id;
--   alter table public.partner_contacts drop column if exists last_login_at;
--   NOT: Enum'dan değer KALDIRMAK Postgres'te native desteklenmez.
--   "partner" değeri kullanılmıyorsa zararı yok. Tamamen silmek için
--   yeni tip yarat + sütunu cast et + eskiyi drop et (riskli, manuel).
