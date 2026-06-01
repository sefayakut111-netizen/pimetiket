-- Migration 137: Sticker alanına 5 tabaka-bazlı ürün kartı
-- Yuvarlak / Kare / Dikdörtgen Etiket Sayfası + Hologram / Simli Sticker Sayfası
--
-- Sefa 1 Haz 2026: "sticker alanına tabaka ürünler, hesap mantığı sticker gibi" + "hologram & simli ekle".
-- Bu migration 5 ürünü ekler. "Özel Kesim Sticker Sayfası" (dış kenar diecut + iç yarım kesim, 2 spot
-- renk) ÜRETİM-KRİTİK olduğundan AYRI faza bırakıldı, burada YOK.
--
-- KARAR (Claude mimari, Sefa onayı):
--  * product_type='sticker' → sticker fiyat motoru (quoteCustomerSticker, cut=tabaka, GAP_TABAKA 6mm).
--    Etiket DEĞİL. Başlık "...Sayfası" ama fiyat+akış sticker.
--  * query_params.kilit='tabaka' → konfigüratör kesim türünü tabaka'ya KİLİTLER (tek-tek'e çevrilemez).
--  * Geometrikler: shape circle/square/rectangle. Holo/Simli: malzeme ürünü → shape='ozel'
--    (shape='diecut'/'die' tabaka ile ÇAKIŞIR, konfigüratör engelliyor) + material=holo/simli.
--    Malzeme çarpanı (holo 1.4, simli 1.3) fiyat motorunda otomatik uygulanır.
--  * Görseller mevcut sticker kartlarından yeniden kullanıldı (grid tutarlılığı; Sefa sonra
--    "sayfa" görselleri ekleyebilir).
-- NOT: Eski "kart adedi sabit 22 — Sefa kararı" kuralı bu eklemeyle geçersiz kılındı.

INSERT INTO public.product_cards
  (product_type, key, title_tr, title_en, desc_tr, desc_en,
   sort_order, is_active, query_params, image_src, svg_id)
VALUES
  ('sticker', 'yuvarlak-sayfa',
   'Yuvarlak Etiket Sayfası', 'Circle Label Sheet',
   'Tek tabakada çok adet yuvarlak — sticker fiyatına', 'Many circles on one sheet',
   12, true, '{"cut":"tabaka","shape":"circle","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-circle.jpg', 'circle'),

  ('sticker', 'kare-sayfa',
   'Kare Etiket Sayfası', 'Square Label Sheet',
   'Tek tabakada çok adet kare — sticker fiyatına', 'Many squares on one sheet',
   13, true, '{"cut":"tabaka","shape":"square","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-square.jpg', 'square'),

  ('sticker', 'dikdortgen-sayfa',
   'Dikdörtgen Etiket Sayfası', 'Rectangle Label Sheet',
   'Tek tabakada çok adet dikdörtgen — sticker fiyatına', 'Many rectangles on one sheet',
   14, true, '{"cut":"tabaka","shape":"rectangle","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-rectangle.jpg', 'rectangle'),

  ('sticker', 'hologram-sayfa',
   'Hologram Sticker Sayfası', 'Holographic Sticker Sheet',
   'Gökkuşağı yansımalı tabaka — premium', 'Rainbow-reflective sheet — premium',
   15, true, '{"cut":"tabaka","shape":"ozel","material":"holo","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-hologram.jpg', 'holo'),

  ('sticker', 'simli-sayfa',
   'Simli Sticker Sayfası', 'Glitter Sticker Sheet',
   'Parıltılı dokulu tabaka — hediye, çocuk', 'Sparkly-texture sheet — gifts, kids',
   16, true, '{"cut":"tabaka","shape":"ozel","material":"simli","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-glitter-holo.jpg', 'glitter')

ON CONFLICT (product_type, key) DO NOTHING;
