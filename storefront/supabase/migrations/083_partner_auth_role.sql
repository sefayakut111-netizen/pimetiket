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

-- 2) profiles.role CHECK constraint — 'partner' ekle
-- Mevcut constraint varsa drop + yeniden oluştur; yoksa direkt oluştur.
do $$
declare
  constraint_name text;
begin
  -- Mevcut role CHECK constraint'in adını bul
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'profiles'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'role'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end$$;

-- Yeni CHECK — 4 rol: customer, staff, admin, partner
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'staff', 'admin', 'partner'));

-- 3) Audit kolaylığı: partner_contacts'a son login zamanı (opsiyonel ama UI'da yararlı)
alter table public.partner_contacts
  add column if not exists last_login_at timestamptz;

-- ============================================================
-- Migration sonu
-- ============================================================
-- Rollback (acil durum):
--   alter table public.partner_contacts drop column if exists user_id;
--   alter table public.partner_contacts drop column if exists last_login_at;
--   alter table public.profiles drop constraint if exists profiles_role_check;
--   alter table public.profiles add constraint profiles_role_check
--     check (role in ('customer', 'staff', 'admin'));
