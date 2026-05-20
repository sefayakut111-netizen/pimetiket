-- Migration 074 · product_cards admin yönetimli grid kartları (Sefa 21 May v68)
--
-- Sorun: /etiket ve /sticker grid kartları HARDCODED — title/desc/sıra
-- değişikliği için kod deploy gerekiyor. Sefa admin panelinden değişiklik
-- yapabilmek istiyor.
--
-- Çözüm: product_cards tablosu — 22 satır (11 etiket + 11 sticker) seed,
-- admin CRUD (/admin/urunler), customer grid sayfalar DB'den okur.

create table if not exists public.product_cards (
  id uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('etiket', 'sticker')),
  key text not null,
  title_tr text not null,
  title_en text not null,
  desc_tr text not null,
  desc_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- query_params: URL slug bilgisi. Etiket: {form, shape}, Sticker:
  -- {cut, shape, material}. Esnek — admin değiştiremez (sadece title/sıra).
  query_params jsonb not null default '{}'::jsonb,
  -- Görsel: etiket için image_src (public SVG dosya yolu),
  -- sticker için svg_id (registry key — "diecut", "circle", "kisscut", vs.)
  image_src text,
  svg_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_cards_unique_key unique (product_type, key),
  constraint product_cards_visual_one check (
    (image_src is not null) or (svg_id is not null)
  )
);

create index if not exists product_cards_type_sort_idx
  on public.product_cards (product_type, sort_order)
  where is_active = true;

-- updated_at touch trigger (Mig 036 pattern)
create or replace function public.set_product_cards_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_cards_updated_at on public.product_cards;
create trigger product_cards_updated_at
  before update on public.product_cards
  for each row execute function public.set_product_cards_updated_at();

-- ============================================================
-- RLS — public read (is_active=true), admin/staff write
-- ============================================================

alter table public.product_cards enable row level security;

drop policy if exists "product_cards_public_select" on public.product_cards;
create policy "product_cards_public_select" on public.product_cards
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "product_cards_admin_all" on public.product_cards;
create policy "product_cards_admin_all" on public.product_cards
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );

-- ============================================================
-- Seed: Etiket (11 kart) + Sticker (11 kart)
-- ============================================================

insert into public.product_cards
  (product_type, key, title_tr, title_en, desc_tr, desc_en, sort_order, query_params, image_src, svg_id)
values
  -- Etiket Rulo (6)
  ('etiket', 'rulo-diecut', 'Özel Kesim Rulo Etiket', 'Die-Cut Roll Label',
   'Logo veya tasarımın silüetine kesim', 'Cut to your design''s silhouette',
   1, '{"form":"rulo","shape":"diecut"}'::jsonb, '/assets/svg/cards/rulo-diecut.svg', null),
  ('etiket', 'rulo-clear', 'Şeffaf Rulo Etiket', 'Clear Roll Label',
   'Saydam zemin — cam şişe, parfüm', 'Transparent base — glass bottles, perfume',
   2, '{"form":"rulo","shape":"clear"}'::jsonb, '/assets/svg/cards/rulo-clear.svg', null),
  ('etiket', 'rulo-circle', 'Yuvarlak Rulo Etiket', 'Circle Roll Label',
   'Daire — kapak, kozmetik klasiği', 'Circle — cap, cosmetics classic',
   3, '{"form":"rulo","shape":"circle"}'::jsonb, '/assets/svg/cards/rulo-circle.svg', null),
  ('etiket', 'rulo-square', 'Kare Rulo Etiket', 'Square Roll Label',
   'Eş kenar — düz veya yumuşak köşe', 'Equal sides — sharp or rounded corner',
   4, '{"form":"rulo","shape":"square"}'::jsonb, '/assets/svg/cards/rulo-square.svg', null),
  ('etiket', 'rulo-rectangle', 'Dikdörtgen Rulo Etiket', 'Rectangle Roll Label',
   'Yaygın etiket formu — düz veya yumuşak köşe', 'Most common label form — sharp or rounded',
   5, '{"form":"rulo","shape":"rectangle"}'::jsonb, '/assets/svg/cards/rulo-rectangle.svg', null),
  ('etiket', 'rulo-oval', 'Oval Rulo Etiket', 'Oval Roll Label',
   'Elips — vintage, şık duruş', 'Ellipse — vintage, elegant',
   6, '{"form":"rulo","shape":"oval"}'::jsonb, '/assets/svg/cards/rulo-oval.svg', null),
  -- Etiket Tabaka (5)
  ('etiket', 'tabaka-circle', 'Yuvarlak Tabaka Etiket', 'Circle Sheet Label',
   'Düşük adet daire — hediye, butik', 'Low quantity circles — gifts, boutique',
   7, '{"form":"tabaka","shape":"circle"}'::jsonb, '/assets/svg/cards/tabaka-circle.svg', null),
  ('etiket', 'tabaka-diecut', 'Özel Kesim Tabaka Etiket', 'Die-Cut Sheet Label',
   'Düşük adet kontur — el yapımı, butik', 'Low quantity contour — handmade, boutique',
   8, '{"form":"tabaka","shape":"diecut"}'::jsonb, '/assets/svg/cards/tabaka-diecut.svg', null),
  ('etiket', 'tabaka-oval', 'Oval Tabaka Etiket', 'Oval Sheet Label',
   'Düşük adet oval kesim', 'Low quantity oval cut',
   9, '{"form":"tabaka","shape":"oval"}'::jsonb, '/assets/svg/cards/tabaka-oval.svg', null),
  ('etiket', 'tabaka-rectangle', 'Dikdörtgen Tabaka Etiket', 'Rectangle Sheet Label',
   'Düşük adet — düz veya yumuşak köşe', 'Low quantity — sharp or rounded corner',
   10, '{"form":"tabaka","shape":"rectangle"}'::jsonb, '/assets/svg/cards/tabaka-rectangle.svg', null),
  ('etiket', 'tabaka-square', 'Kare Tabaka Etiket', 'Square Sheet Label',
   'Düşük adet — düz veya yumuşak köşe', 'Low quantity — sharp or rounded corner',
   11, '{"form":"tabaka","shape":"square"}'::jsonb, '/assets/svg/cards/tabaka-square.svg', null),
  -- Sticker (11)
  ('sticker', 'diecut', 'Özel Kesim Sticker', 'Die-Cut Sticker',
   'Logo veya tasarımın silüetine kesim', 'Cut to your design''s silhouette',
   1, '{"cut":"diecut","shape":"diecut"}'::jsonb, null, 'diecut'),
  ('sticker', 'circle', 'Yuvarlak Sticker', 'Circle Sticker',
   'Daire form — laptop, su şişesi, marka', 'Circle form — laptop, water bottle, logo',
   2, '{"cut":"diecut","shape":"circle"}'::jsonb, null, 'circle'),
  ('sticker', 'rectangle', 'Dikdörtgen Sticker', 'Rectangle Sticker',
   'Yaygın form — düz veya yumuşak köşe', 'Most common form — sharp or rounded corner',
   3, '{"cut":"diecut","shape":"rectangle"}'::jsonb, null, 'rectangle'),
  ('sticker', 'square', 'Kare Sticker', 'Square Sticker',
   'Eş kenar — düz veya yumuşak köşe', 'Equal sides — sharp or rounded corner',
   4, '{"cut":"diecut","shape":"square"}'::jsonb, null, 'square'),
  ('sticker', 'oval', 'Oval Sticker', 'Oval Sticker',
   'Elips — vintage, organik form', 'Ellipse — vintage, organic',
   5, '{"cut":"diecut","shape":"oval"}'::jsonb, null, 'oval'),
  ('sticker', 'bumper', 'Bumper Sticker', 'Bumper Sticker',
   'Uzun yatay — hobi, laptop', 'Long horizontal — hobby, laptop',
   6, '{"cut":"diecut","shape":"bumper"}'::jsonb, null, 'bumper'),
  ('sticker', 'kisscut', 'Yarı Kesim Sticker', 'Kiss-Cut Sticker',
   'Çevresi sağlam kağıttan tek tek çıkarılır', 'Sticker cut, backing intact — peel individually',
   7, '{"cut":"kisscut","shape":"diecut"}'::jsonb, null, 'kisscut'),
  ('sticker', 'clear', 'Şeffaf Sticker', 'Clear Sticker',
   'Saydam zemin — cam, arka plan görünsün', 'Transparent base — glass, background visible',
   8, '{"cut":"diecut","shape":"diecut","material":"transparan"}'::jsonb, null, 'clear'),
  ('sticker', 'holo', 'Holografik Sticker', 'Holographic Sticker',
   'Gökkuşağı yansıma — premium, etkinlik', 'Rainbow reflection — premium, events',
   9, '{"cut":"diecut","shape":"diecut","material":"holo"}'::jsonb, null, 'holo'),
  ('sticker', 'glitter', 'Simli Sticker', 'Glitter Sticker',
   'Parıltılı dokulu — çocuk, hediye', 'Sparkly texture — kids, gifts',
   10, '{"cut":"diecut","shape":"diecut","material":"simli"}'::jsonb, null, 'glitter'),
  ('sticker', 'sheet', 'Sticker Sayfası', 'Sticker Sheet',
   'Karma şekiller, tek sayfada', 'Mixed shapes on a single sheet',
   11, '{"cut":"tabaka","shape":"square"}'::jsonb, null, 'sheet')
on conflict (product_type, key) do nothing;
