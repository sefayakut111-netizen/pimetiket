-- Migration 151: Tabaka sticker'a 2 ürün — Özel Kesim + Şeffaf Sticker Sayfası
-- Sefa kararı (4 Haz): özel kesim = kare/yuvarlak sayfa ile AYNI basit model (sticker
-- fiyat motoru, cut=tabaka, shape=ozel). mig137'deki "ertelenen üretim" notu Sefa onayıyla
-- geçersiz. Şeffaf: holo/simli pattern, material=transparan (çarpan 1.1 mevcut config'te).

INSERT INTO public.product_cards
  (product_type, key, title_tr, title_en, desc_tr, desc_en,
   sort_order, is_active, query_params, image_src, svg_id)
VALUES
  ('sticker', 'ozel-sayfa',
   'Özel Kesim Sticker Sayfası', 'Die-Cut Sticker Sheet',
   'Tek tabakada çok adet özel kesim', 'Many die-cut on one sheet',
   17, true, '{"cut":"tabaka","shape":"ozel","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-tabaka-ozel.jpg', 'diecut'),

  ('sticker', 'seffaf-sayfa',
   'Şeffaf Sticker Sayfası', 'Clear Sticker Sheet',
   'Şeffaf zeminde çok adet', 'Clear, many on one sheet',
   18, true, '{"cut":"tabaka","shape":"ozel","material":"transparan","kilit":"tabaka"}'::jsonb,
   '/assets/img/cards/sticker-tabaka-seffaf.png', 'clear')

ON CONFLICT (product_type, key) DO NOTHING;
