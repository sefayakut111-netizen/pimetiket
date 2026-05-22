-- ============================================================
-- Migration 080 — product_cards image_src .png → .jpg
-- ============================================================
--
-- Sefa 22 May v68 follow-up:
-- Sefa görselleri ufalttı + JPG'ye çevirdi (boyut 30MB → 1.4MB). Kod
-- tarafında .png referansları .jpg'ye geçirildi, bu migration DB'yi
-- senkronize eder. tabaka-circle için Sefa yeni JPG hazırlamadı → eski
-- SVG fallback geri yüklenir.
--
-- Bu migration kod deploy edildikten SONRA uygulanmalı; yoksa
-- production'da JPG dosyaları henüz yokken DB JPG'yi gösterir, 404 olur.
-- ============================================================

-- Etiket Rulo (6) — .png → .jpg
update public.product_cards set image_src = '/assets/img/cards/rulo-diecut.jpg'
 where product_type = 'etiket' and key = 'rulo-diecut';
update public.product_cards set image_src = '/assets/img/cards/rulo-clear.jpg'
 where product_type = 'etiket' and key = 'rulo-clear';
update public.product_cards set image_src = '/assets/img/cards/rulo-circle.jpg'
 where product_type = 'etiket' and key = 'rulo-circle';
update public.product_cards set image_src = '/assets/img/cards/rulo-square.jpg'
 where product_type = 'etiket' and key = 'rulo-square';
update public.product_cards set image_src = '/assets/img/cards/rulo-rectangle.jpg'
 where product_type = 'etiket' and key = 'rulo-rectangle';
update public.product_cards set image_src = '/assets/img/cards/rulo-oval.jpg'
 where product_type = 'etiket' and key = 'rulo-oval';

-- Etiket Tabaka — tabaka-circle SVG fallback'e geri dön (Sefa hazırlamadı)
update public.product_cards set image_src = '/assets/svg/cards/tabaka-circle.svg'
 where product_type = 'etiket' and key = 'tabaka-circle';
update public.product_cards set image_src = '/assets/img/cards/tabaka-diecut.jpg'
 where product_type = 'etiket' and key = 'tabaka-diecut';
update public.product_cards set image_src = '/assets/img/cards/tabaka-rectangle.jpg'
 where product_type = 'etiket' and key = 'tabaka-rectangle';
update public.product_cards set image_src = '/assets/img/cards/tabaka-square.jpg'
 where product_type = 'etiket' and key = 'tabaka-square';
-- tabaka-oval: dokunulmaz (SVG fallback'te kaldı)

-- Sticker (11) — .png → .jpg
update public.product_cards set image_src = '/assets/img/cards/sticker-diecut.jpg'
 where product_type = 'sticker' and key = 'diecut';
update public.product_cards set image_src = '/assets/img/cards/sticker-circle.jpg'
 where product_type = 'sticker' and key = 'circle';
update public.product_cards set image_src = '/assets/img/cards/sticker-rectangle.jpg'
 where product_type = 'sticker' and key = 'rectangle';
update public.product_cards set image_src = '/assets/img/cards/sticker-square.jpg'
 where product_type = 'sticker' and key = 'square';
update public.product_cards set image_src = '/assets/img/cards/sticker-oval.jpg'
 where product_type = 'sticker' and key = 'oval';
update public.product_cards set image_src = '/assets/img/cards/sticker-bumper.jpg'
 where product_type = 'sticker' and key = 'bumper';
update public.product_cards set image_src = '/assets/img/cards/sticker-kisscut.jpg'
 where product_type = 'sticker' and key = 'kisscut';
update public.product_cards set image_src = '/assets/img/cards/sticker-clear.jpg'
 where product_type = 'sticker' and key = 'clear';
update public.product_cards set image_src = '/assets/img/cards/sticker-hologram.jpg'
 where product_type = 'sticker' and key = 'holo';
update public.product_cards set image_src = '/assets/img/cards/sticker-glitter-holo.jpg'
 where product_type = 'sticker' and key = 'glitter';
update public.product_cards set image_src = '/assets/img/cards/sticker-sheet.jpg'
 where product_type = 'sticker' and key = 'sheet';
