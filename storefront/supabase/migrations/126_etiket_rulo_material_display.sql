-- Migration 126 — etiket_rulo malzeme görünen adları normalize (müşteri UI)
-- Admin pricing_config'teki legacy "Beyaz semi-glos" vb. → konfigüratör const ile uyumlu TR adlar.

update public.pricing_config
set live_config = jsonb_set(
  live_config,
  '{materials}',
  coalesce(
    (
      select jsonb_agg(
        case
          when elem->>'id' = 'kuse' then jsonb_set(elem, '{name}', '"Kuşe Etiket"'::jsonb)
          when elem->>'id' = 'beyaz' then jsonb_set(elem, '{name}', '"Opak PP Etiket"'::jsonb)
          when elem->>'id' = 'seffaf' then jsonb_set(elem, '{name}', '"Şeffaf Etiket"'::jsonb)
          when elem->>'id' = 'metalik' then jsonb_set(elem, '{name}', '"Metalize Etiket"'::jsonb)
          when elem->>'id' = 'kraft' then jsonb_set(elem, '{name}', '"Kraft Etiket"'::jsonb)
          when elem->>'id' = 'ultra' then jsonb_set(elem, '{name}', '"Ultra Clear Etiket"'::jsonb)
          else elem
        end
        order by ord
      )
      from jsonb_array_elements(live_config->'materials') with ordinality as t(elem, ord)
    ),
    live_config->'materials'
  ),
  true
)
where scope = 'etiket_rulo'
  and live_config ? 'materials'
  and jsonb_typeof(live_config->'materials') = 'array';
