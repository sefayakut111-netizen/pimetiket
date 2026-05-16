-- ============================================================
-- Pim Etiket — Migration 042: Email Verification Sync Trigger
--
-- Sefa 16 May üyelik audit'i bulgu:
-- auth.users.email_confirmed_at doluyor ama profiles.email_verified_at
-- güncellenmiyordu. /auth/callback'te client-side sync eklendi
-- ama trigger ile DB-level garanti veriyoruz.
--
-- Trigger: on_auth_user_email_confirmed
--   - AFTER UPDATE on auth.users
--   - Eğer email_confirmed_at null'dan doldu ise
--   - profiles.email_verified_at = NEW.email_confirmed_at SET
--
-- İdempotent: zaten dolu profile'a tekrar yazmaz.
-- ============================================================

create or replace function public.handle_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Sadece email_confirmed_at null'dan doluya geçtiyse
  if old.email_confirmed_at is null
     and new.email_confirmed_at is not null then
    update public.profiles
    set
      email_verified_at = new.email_confirmed_at,
      updated_at = now()
    where id = new.id
      and email_verified_at is null;
  end if;
  return new;
end;
$$;

comment on function public.handle_email_confirmation() is
  'auth.users.email_confirmed_at doldukça profiles.email_verified_at sync eder. Migration 042 — Sefa 16 May üyelik audit fix.';


-- Mevcut trigger varsa drop et (idempotent migration)
drop trigger if exists on_auth_user_email_confirmed on auth.users;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is distinct from new.email_confirmed_at)
  execute function public.handle_email_confirmation();


-- ============================================================
-- Geriye dönük sync — mevcut doğrulu kullanıcılar için
-- ============================================================
-- auth.users.email_confirmed_at dolu olup profiles.email_verified_at
-- null olan kullanıcıları toplu güncelle.

update public.profiles p
set
  email_verified_at = u.email_confirmed_at,
  updated_at = now()
from auth.users u
where p.id = u.id
  and p.email_verified_at is null
  and u.email_confirmed_at is not null;


-- ============================================================
-- Migration 042 sonu
-- ============================================================
