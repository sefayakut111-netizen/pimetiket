-- ============================================================
-- Migration 081 — tabaka-circle ve tabaka-oval JPG'ye geç
-- ============================================================
--
-- Sefa 22 May v68 follow-up:
-- Sefa Küçültülmüş klasörüne "Yuvarlak Tabaka Etiket.jpg" ve "Oval Tabaka
-- Etiket.jpg" ekledi. Mig 080'de bunlar SVG fallback'te kalmıştı.
-- Bonus: tabaka-diecut JPG'si yeniden hazırlandı (yeni çizim), path aynı
-- (image_src zaten /assets/img/cards/tabaka-diecut.jpg) → DB UPDATE
-- gerekmez, sadece dosya overwrite oldu (deploy ile birlikte gelecek).
--
-- KOD DEPLOY EDILDIKTEN SONRA APPLY EDILMELI.
-- ============================================================

update public.product_cards
   set image_src = '/assets/img/cards/tabaka-circle.jpg'
 where product_type = 'etiket' and key = 'tabaka-circle';

update public.product_cards
   set image_src = '/assets/img/cards/tabaka-oval.jpg'
 where product_type = 'etiket' and key = 'tabaka-oval';

-- Doğrulama:
--   SELECT key, image_src FROM public.product_cards
--    WHERE product_type='etiket' AND key IN ('tabaka-circle', 'tabaka-oval');
