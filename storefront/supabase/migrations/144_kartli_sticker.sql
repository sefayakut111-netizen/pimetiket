-- Migration 144: Yarı Kesim kartı → Kartlı Sticker (hibrit ThruCut + KissCut)
--
-- Grid kartı die cut sütununda kalır; query_params cut=kartli (Özel Kesim ile çakışma yok).
-- key='kisscut' değiştirilmez (referans riski).

UPDATE public.product_cards
SET
  title_tr = 'Kartlı Sticker',
  title_en = 'Kiss-Cut Single',
  desc_tr = 'Sticker kendi die-cut kartında; içinden tek tek soyulur.',
  desc_en = 'Sticker on its own die-cut card; peel off individually.',
  query_params = '{"cut":"kartli","shape":"diecut"}'::jsonb
WHERE product_type = 'sticker'
  AND key = 'kisscut';
