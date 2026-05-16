-- ============================================================
-- Pim Etiket — Migration 044: customer_invoice_profiles
--
-- Sefa 17 May UX denetim:
-- Kullanıcının birden fazla kurumsal fatura profili kaydedebilmesi
-- (örn: kişisel şirketi + babasının şirketi) ihtiyacı.
--
-- Hard limit: 2 corporate invoice profile per user.
-- Hard limit: 5 address per user (mevcut addresses tablosuna trigger eklendi).
--
-- Profiles tablosundaki vkn/company_name/tax_office alanları kalıyor
-- (legacy + tek-fatura kullanıcı için fallback). Yeni kayıt buraya
-- gelir, /odeme akışı bu tabloyu okur.
--
-- Adres alanı eklendi (mesafeli satış yönetmeliği m.5/c gereği
-- e-faturada satıcı adresi gibi alıcı adresi de zorunludur).
-- ============================================================

create table if not exists public.customer_invoice_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Kullanıcı etiketi (örn: "Kendi şirketim", "Baba şirket")
  label           text,

  -- Kurumsal alanlar
  vkn             text not null,
  company_name    text not null,
  tax_office      text not null,
  company_address text not null, -- mesafeli satış m.5/c — alıcı adresi

  -- Bayraklar
  is_default      boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint vkn_format check (vkn ~ '^[0-9]{10}$')
);

create index if not exists idx_customer_invoice_profiles_user
  on public.customer_invoice_profiles (user_id);

-- ============================================================
-- RLS — kullanıcı sadece kendi faturalarını görür/yönetir
-- ============================================================

alter table public.customer_invoice_profiles enable row level security;

drop policy if exists "invoice_profiles_select_own"
  on public.customer_invoice_profiles;
create policy "invoice_profiles_select_own"
  on public.customer_invoice_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "invoice_profiles_insert_own"
  on public.customer_invoice_profiles;
create policy "invoice_profiles_insert_own"
  on public.customer_invoice_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "invoice_profiles_update_own"
  on public.customer_invoice_profiles;
create policy "invoice_profiles_update_own"
  on public.customer_invoice_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "invoice_profiles_delete_own"
  on public.customer_invoice_profiles;
create policy "invoice_profiles_delete_own"
  on public.customer_invoice_profiles
  for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Trigger: MAX 2 fatura profili / kullanıcı (server-side enforcement)
-- ============================================================

create or replace function public.fn_enforce_invoice_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.customer_invoice_profiles
    where user_id = new.user_id;

  if v_count >= 2 then
    raise exception 'invoice_profile_limit_reached'
      using hint = 'Maksimum 2 kurumsal fatura kaydedebilirsiniz. Yeni eklemek için bir kaydı silin.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoice_profile_limit
  on public.customer_invoice_profiles;
create trigger trg_invoice_profile_limit
  before insert on public.customer_invoice_profiles
  for each row execute function public.fn_enforce_invoice_profile_limit();

-- ============================================================
-- Trigger: updated_at otomatik
-- ============================================================

create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoice_profile_touch
  on public.customer_invoice_profiles;
create trigger trg_invoice_profile_touch
  before update on public.customer_invoice_profiles
  for each row execute function public.fn_touch_updated_at();

-- ============================================================
-- Trigger: MAX 5 adres / kullanıcı (addresses tablosu)
-- ============================================================

create or replace function public.fn_enforce_address_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.addresses
    where user_id = new.user_id;

  if v_count >= 5 then
    raise exception 'address_limit_reached'
      using hint = 'Maksimum 5 adres kaydedebilirsiniz. Yeni eklemek için bir kaydı silin.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_address_limit
  on public.addresses;
create trigger trg_address_limit
  before insert on public.addresses
  for each row execute function public.fn_enforce_address_limit();

-- ============================================================
-- Helper: tek default — yeni default işaretlenince diğerlerini kaldır
-- ============================================================

create or replace function public.fn_invoice_profile_single_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default = true then
    update public.customer_invoice_profiles
      set is_default = false
      where user_id = new.user_id
        and id != new.id
        and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_profile_single_default
  on public.customer_invoice_profiles;
create trigger trg_invoice_profile_single_default
  after insert or update of is_default
  on public.customer_invoice_profiles
  for each row
  when (new.is_default = true)
  execute function public.fn_invoice_profile_single_default();

-- ============================================================
-- Comments (admin için)
-- ============================================================

comment on table public.customer_invoice_profiles is
  'Kullanıcı tarafından kaydedilen kurumsal fatura profilleri. MAX 2/user (trigger enforced). Mesafeli Satış m.5/c uyumu için adres zorunlu.';

comment on column public.customer_invoice_profiles.vkn is
  '10 haneli vergi kimlik numarası. CHECK constraint ile format doğrulanır.';

comment on column public.customer_invoice_profiles.company_address is
  'E-fatura adresi. Mesafeli Satış Yönetmeliği m.5/c gereği zorunlu.';
