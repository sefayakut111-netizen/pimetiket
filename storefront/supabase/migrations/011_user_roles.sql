-- ============================================================
-- Pim Etiket — Migration 011: User Roles (admin/staff/customer)
--
-- profiles tablosuna role kolonu ekler + middleware /admin guard için
-- helper function. Mevcut tüm kullanıcılar default 'customer' alır.
-- Admin yapılması gereken kullanıcılar tek tek UPDATE ile işaretlenir.
-- ============================================================

-- ---------- user_role enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum (
      'customer',  -- default — sadece kendi sipariş/iade/profil
      'staff',     -- admin paneli erişim, AMA bazı kritik aksiyonlar yok
      'admin'      -- tam erişim (Sefa)
    );
  end if;
end$$;

-- ---------- profiles.role kolonu ----------
alter table public.profiles
  add column if not exists role public.user_role not null default 'customer';

create index if not exists profiles_role_idx
  on public.profiles(role)
  where role <> 'customer';

-- ---------- Helper: is_admin (RPC + RLS için) ----------

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_super_admin(uuid) to authenticated;

-- ---------- profiles.role için RLS policy ----------
-- Kullanıcı kendi role'ünü göremez/değiştiremez (sadece service_role)

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can update own profile name/phone" on public.profiles;
create policy "Users can update own profile name/phone"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Role değiştirilemez (DB-level guard)
    and role = (select role from public.profiles where id = auth.uid())
  );

-- ---------- Trigger: yeni kullanıcı oluşturulunca profile + role ----------
-- Supabase auth.users'a INSERT olduğunda otomatik profile oluştur (role=customer)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- Migration 011 sonu
--
-- Sefa'nın hesabını admin yapmak için:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'info@pimetiket.com');
-- ============================================================
