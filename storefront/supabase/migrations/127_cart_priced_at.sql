-- Migration 127: cart_items.priced_at — fiyat sürümü tazeliği (sepet reprice)
alter table public.cart_items
  add column if not exists priced_at timestamptz not null default now();

update public.cart_items
set priced_at = added_at
where priced_at is null;
