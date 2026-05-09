-- ============================================================
-- Pim Etiket — Initial schema (Faz 1)
--
-- Tablolar:
--   profiles (auth.users 1:1)
--   addresses
--   cart_items
--   orders + order_items
--   wallet_transactions
--
-- Tüm tablolar RLS aktif: kullanıcı sadece kendi satırlarına
-- erişebilir. auth.uid() = user_id kuralı.
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------- addresses ----------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  name text not null,
  addr text not null,
  city text not null,
  phone text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_id_idx on public.addresses(user_id);

alter table public.addresses enable row level security;

create policy "Users can manage own addresses"
  on public.addresses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- cart_items ----------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('sticker', 'etiket')),
  title text not null,
  config text not null,
  width integer not null,
  height integer not null,
  qty integer not null check (qty > 0),
  unit numeric(10, 2) not null,
  total numeric(10, 2) not null,
  -- Sticker özel
  shape text,
  cut text check (cut is null or cut in ('tabaka', 'diecut')),
  soft_corners boolean,
  material text,
  finish text,
  hediye_adet integer,
  -- Etiket özel
  material_id text,
  coating_id text,
  customization_id text,
  winding integer,
  added_at timestamptz not null default now()
);

create index if not exists cart_items_user_id_idx on public.cart_items(user_id);

alter table public.cart_items enable row level security;

create policy "Users can manage own cart"
  on public.cart_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- orders ----------
create type public.order_status as enum (
  'paid',
  'qc_pending',
  'qc_flagged',
  'operator_review',
  'proof_pending',
  'in_production',
  'shipped',
  'delivered',
  'cancelled'
);

create table if not exists public.orders (
  -- PE-2026-XXXX formatı, app tarafında üretilir
  id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  status public.order_status not null default 'paid',
  subtotal numeric(10, 2) not null,
  shipping numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  -- JSON snapshot — checkout anında dondurulur
  address jsonb not null,
  invoice jsonb not null,
  payment jsonb not null,
  estimated_delivery date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

alter table public.orders enable row level security;

-- Müşteri sadece kendi siparişlerini görür
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Müşteri yeni sipariş oluşturabilir
create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- Müşteri durumu güncelleyemez (admin tarafı service_role ile yönetir)
-- → update policy YOK, sadece service_role yapabilir.

-- ---------- order_items ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product text not null check (product in ('sticker', 'etiket')),
  title text not null,
  config text not null,
  width integer not null,
  height integer not null,
  qty integer not null,
  unit numeric(10, 2) not null,
  total numeric(10, 2) not null,
  -- Tüm konfigürasyon snapshot'ı (cart_items mirror'u)
  meta jsonb not null default '{}'::jsonb
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.order_items enable row level security;

create policy "Users can view own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "Users can insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- ---------- wallet_transactions ----------
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Pozitif: yatırım/iade. Negatif: sipariş ödeme.
  amount numeric(10, 2) not null,
  description text not null,
  order_id text references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_user_id_idx on public.wallet_transactions(user_id);

alter table public.wallet_transactions enable row level security;

create policy "Users can view own wallet"
  on public.wallet_transactions for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE sadece service_role (admin tarafı) — müşteri direkt
-- bakiye değiştiremesin.

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- ---------- auth.users → profiles auto-create ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
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
