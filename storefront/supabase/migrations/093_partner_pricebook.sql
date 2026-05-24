-- ============================================================
-- Pim Etiket — Migration 093: Partner Price Book (rulo etiket)
--
-- WxH x qty matris + admin CRUD. Tabaka matris degil (sheet modu).
-- ============================================================

-- Global markup (retail katmani)
alter table public.site_settings
  add column if not exists pricing_markup_pct numeric(5, 2) not null default 50.0;

comment on column public.site_settings.pricing_markup_pct is
  'Partner price book ham fiyatina uygulanan global kar marji (%).';

-- ------------------------------------------------------------
-- 1) Eksenler (width / height / qty)
-- ------------------------------------------------------------
create table if not exists public.partner_pricebook_axes (
  id uuid primary key default gen_random_uuid(),
  product_type text not null default 'etiket_rulo'
    check (product_type in ('etiket_rulo')),
  axis text not null check (axis in ('width', 'height', 'qty')),
  value_mm integer not null check (value_mm > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_type, axis, value_mm)
);

create index if not exists partner_pricebook_axes_lookup_idx
  on public.partner_pricebook_axes (product_type, axis, display_order);

-- ------------------------------------------------------------
-- 2) Malzeme matrisleri
-- ------------------------------------------------------------
create table if not exists public.partner_pricebook_matrices (
  id uuid primary key default gen_random_uuid(),
  product_type text not null default 'etiket_rulo'
    check (product_type in ('etiket_rulo')),
  material_key text not null,
  display_name text not null,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_type, material_key)
);

-- ------------------------------------------------------------
-- 3) Hucreler (WxH x qty -> TL/adet partner ham)
-- ------------------------------------------------------------
create table if not exists public.partner_pricebook_cells (
  matrix_id uuid not null
    references public.partner_pricebook_matrices(id) on delete cascade,
  width_mm integer not null check (width_mm > 0),
  height_mm integer not null check (height_mm > 0),
  qty integer not null check (qty > 0),
  price_per_unit numeric(10, 4) not null check (price_per_unit >= 0),
  updated_at timestamptz not null default now(),
  primary key (matrix_id, width_mm, height_mm, qty)
);

create index if not exists partner_pricebook_cells_matrix_idx
  on public.partner_pricebook_cells (matrix_id);

-- ------------------------------------------------------------
-- RLS — public read, admin write via service role / staff
-- ------------------------------------------------------------
alter table public.partner_pricebook_axes enable row level security;
alter table public.partner_pricebook_matrices enable row level security;
alter table public.partner_pricebook_cells enable row level security;

drop policy if exists "Anyone can read pricebook axes" on public.partner_pricebook_axes;
create policy "Anyone can read pricebook axes"
  on public.partner_pricebook_axes for select using (true);

drop policy if exists "Anyone can read pricebook matrices" on public.partner_pricebook_matrices;
create policy "Anyone can read pricebook matrices"
  on public.partner_pricebook_matrices for select using (true);

drop policy if exists "Anyone can read pricebook cells" on public.partner_pricebook_cells;
create policy "Anyone can read pricebook cells"
  on public.partner_pricebook_cells for select using (true);

-- ------------------------------------------------------------
-- Seed: rulo eksenler + kuse ornek matris (PRICING-MATRIX.md)
-- ------------------------------------------------------------
insert into public.partner_pricebook_axes (product_type, axis, value_mm, display_order)
values
  ('etiket_rulo', 'width',  30,  0),
  ('etiket_rulo', 'width',  50,  1),
  ('etiket_rulo', 'width',  70,  2),
  ('etiket_rulo', 'width', 100,  3),
  ('etiket_rulo', 'width', 150,  4),
  ('etiket_rulo', 'width', 300,  5),
  ('etiket_rulo', 'height', 30,  0),
  ('etiket_rulo', 'height', 50,  1),
  ('etiket_rulo', 'height', 70,  2),
  ('etiket_rulo', 'height', 100,  3),
  ('etiket_rulo', 'height', 150,  4),
  ('etiket_rulo', 'height', 450,  5),
  ('etiket_rulo', 'qty', 1000,  0),
  ('etiket_rulo', 'qty', 3000,  1),
  ('etiket_rulo', 'qty', 5000,  2),
  ('etiket_rulo', 'qty', 10000, 3)
on conflict (product_type, axis, value_mm) do nothing;

insert into public.partner_pricebook_matrices (product_type, material_key, display_name, active, version)
values ('etiket_rulo', 'kuse', 'Kuşe Rulo Etiket', true, 1)
on conflict (product_type, material_key) do nothing;

-- Ornek hucreler: kare boyutlar x qty (TL/adet)
insert into public.partner_pricebook_cells (matrix_id, width_mm, height_mm, qty, price_per_unit)
select m.id, v.w, v.h, v.q, v.p
from public.partner_pricebook_matrices m
cross join (
  values
    (30,  30,  1000, 0.2000),
    (30,  30,  3000, 0.1500),
    (30,  30,  5000, 0.1200),
    (30,  30, 10000, 0.0900),
    (50,  50,  1000, 0.3500),
    (50,  50,  3000, 0.2700),
    (50,  50,  5000, 0.2200),
    (50,  50, 10000, 0.1700),
    (70,  70,  1000, 0.5500),
    (70,  70,  3000, 0.4200),
    (70,  70,  5000, 0.3500),
    (70,  70, 10000, 0.2700),
    (100, 100, 1000, 0.8500),
    (100, 100, 3000, 0.6500),
    (100, 100, 5000, 0.5500),
    (100, 100, 10000, 0.4200),
    (150, 150, 1000, 1.5000),
    (150, 150, 3000, 1.2500),
    (150, 150, 5000, 1.1000),
    (150, 150, 10000, 0.8500),
    (300, 450, 1000, 2.5000),
    (300, 450, 3000, 2.1000),
    (300, 450, 5000, 1.8500),
    (300, 450, 10000, 1.5000)
) as v(w, h, q, p)
where m.product_type = 'etiket_rulo' and m.material_key = 'kuse'
on conflict (matrix_id, width_mm, height_mm, qty) do nothing;

-- etiket_rulo scope: pricebook modu
update public.pricing_config
set
  live_config = live_config || '{"pricing_mode":"pricebook"}'::jsonb,
  draft_config = draft_config || '{"pricing_mode":"pricebook"}'::jsonb
where scope = 'etiket_rulo';

-- ============================================================
-- Migration 093 sonu
-- ============================================================
