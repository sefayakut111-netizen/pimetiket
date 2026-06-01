-- Migration 142: Yarı Kesim Sticker → die-cut fiyat/özellik (kisscut değil)
--
-- Grid kartı die cut sütununda; query_params cut=diecut (diecut çarpanı 1.10).
-- Sıra: simli sticker'dan sonra (sort_order 11).

UPDATE public.product_cards
SET sort_order = sort_order + 1
WHERE product_type = 'sticker'
  AND sort_order >= 11
  AND key <> 'kisscut';

UPDATE public.product_cards
SET
  query_params = '{"cut":"diecut","shape":"diecut"}'::jsonb,
  sort_order = 11
WHERE product_type = 'sticker'
  AND key = 'kisscut';
