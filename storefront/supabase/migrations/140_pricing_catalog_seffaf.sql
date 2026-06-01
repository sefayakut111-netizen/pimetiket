-- Migration 140: Eksik katalog öğelerini pricing_config + pricebook'a ekle
--
-- Konfigüratörde "seffaf" (Şeffaf Rulo Etiket) var; Mig 049 pricing_config'ten
-- düşmüştü. Pricebook'ta da matris yoktu → admin /fiyatlar'da görünmüyordu.
--
-- Bu migration:
--   1. etiket_rulo materials[] içine seffaf ekler (yoksa)
--   2. partner_pricebook_matrices + cells için seffaf seed (ultra oranı)

-- ============================================================
-- 1. etiket_rulo — seffaf malzeme
-- ============================================================

update public.pricing_config
set
  draft_config = jsonb_set(
    draft_config,
    '{materials}',
    coalesce(draft_config->'materials', '[]'::jsonb) || '[
      {
        "id": "seffaf",
        "name": "Şeffaf Etiket",
        "desc": "Arka planı gösteren saydam etiket",
        "m2_cost_try": 600,
        "active": true
      }
    ]'::jsonb,
    true
  ),
  live_config = jsonb_set(
    live_config,
    '{materials}',
    coalesce(live_config->'materials', '[]'::jsonb) || '[
      {
        "id": "seffaf",
        "name": "Şeffaf Etiket",
        "desc": "Arka planı gösteren saydam etiket",
        "m2_cost_try": 600,
        "active": true
      }
    ]'::jsonb,
    true
  )
where scope = 'etiket_rulo'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(live_config->'materials', '[]'::jsonb)) elem
    where elem->>'id' = 'seffaf'
  );

-- ============================================================
-- 2. Pricebook — seffaf matrisi (ultra ile aynı çarpan: 600/350)
-- ============================================================

insert into public.partner_pricebook_matrices (product_type, material_key, display_name, active, version)
values ('etiket_rulo', 'seffaf', 'Şeffaf Rulo Etiket', true, 1)
on conflict (product_type, material_key) do nothing;

insert into public.partner_pricebook_cells (matrix_id, width_mm, height_mm, qty, price_per_unit)
select
  tgt_m.id,
  src.width_mm,
  src.height_mm,
  src.qty,
  round((src.price_per_unit * (600.0 / 350.0))::numeric, 4)
from public.partner_pricebook_matrices kuse_m
inner join public.partner_pricebook_cells src on src.matrix_id = kuse_m.id
inner join public.partner_pricebook_matrices tgt_m
  on tgt_m.material_key = 'seffaf'
  and tgt_m.product_type = 'etiket_rulo'
where kuse_m.product_type = 'etiket_rulo'
  and kuse_m.material_key = 'kuse'
on conflict (matrix_id, width_mm, height_mm, qty) do nothing;
