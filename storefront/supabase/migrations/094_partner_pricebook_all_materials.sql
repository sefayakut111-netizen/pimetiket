-- ============================================================
-- Pim Etiket — Migration 094: Price book — 5 malzeme seed
--
-- 093 sonrasi: kraft, beyaz, ultra, metalik matrisleri (kuşe oranli)
-- ============================================================

insert into public.partner_pricebook_matrices (product_type, material_key, display_name, active, version)
values
  ('etiket_rulo', 'kraft',   'Kraft Rulo Etiket',       true, 1),
  ('etiket_rulo', 'beyaz',   'Opak PP Rulo Etiket',     true, 1),
  ('etiket_rulo', 'ultra',   'Ultra Clear Rulo Etiket', true, 1),
  ('etiket_rulo', 'metalik', 'Metalik Rulo Etiket',     true, 1)
on conflict (product_type, material_key) do nothing;

-- kuse hucrelerini malzeme carpani ile kopyala
insert into public.partner_pricebook_cells (matrix_id, width_mm, height_mm, qty, price_per_unit)
select
  tgt_m.id,
  src.width_mm,
  src.height_mm,
  src.qty,
  round((src.price_per_unit * mult)::numeric, 4)
from public.partner_pricebook_matrices kuse_m
inner join public.partner_pricebook_cells src on src.matrix_id = kuse_m.id
cross join (
  values
    ('kraft'::text,   (300.0 / 350.0)::numeric),
    ('beyaz',         (400.0 / 350.0)::numeric),
    ('ultra',         (600.0 / 350.0)::numeric),
    ('metalik',       (900.0 / 350.0)::numeric)
) as scale(material_key, mult)
inner join public.partner_pricebook_matrices tgt_m
  on tgt_m.material_key = scale.material_key
  and tgt_m.product_type = 'etiket_rulo'
where kuse_m.product_type = 'etiket_rulo'
  and kuse_m.material_key = 'kuse'
on conflict (matrix_id, width_mm, height_mm, qty) do nothing;

-- ============================================================
-- Migration 094 sonu
-- ============================================================
