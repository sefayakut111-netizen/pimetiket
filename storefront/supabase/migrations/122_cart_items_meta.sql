-- Migration 122 — cart_items.meta (formFactor, customizations, designCount)
alter table public.cart_items
  add column if not exists meta jsonb;

comment on column public.cart_items.meta is
  'Konfigüratör meta: formFactor (rulo/tabaka), customizations[], designCount vb.';
