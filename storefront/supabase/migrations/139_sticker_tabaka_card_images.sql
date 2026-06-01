-- Migration 139: 5 tabaka sticker kartının image_src'sini gerçek "tabaka sticker" görselleriyle güncelle
--
-- Sefa 1 Haz 2026: yeni tabaka ürünleri için özel görseller verdi
-- (Ürün ikonları/Küçültülmüş/tabaka sticker/). Görseller public/assets/img/cards/'a
-- sticker-tabaka-*.jpg adlarıyla kopyalandı. mig 137'de reuse edilen görseller değiştiriliyor.

UPDATE public.product_cards SET image_src = '/assets/img/cards/sticker-tabaka-circle.jpg'
  WHERE product_type = 'sticker' AND key = 'yuvarlak-sayfa';

UPDATE public.product_cards SET image_src = '/assets/img/cards/sticker-tabaka-square.jpg'
  WHERE product_type = 'sticker' AND key = 'kare-sayfa';

UPDATE public.product_cards SET image_src = '/assets/img/cards/sticker-tabaka-rectangle.jpg'
  WHERE product_type = 'sticker' AND key = 'dikdortgen-sayfa';

UPDATE public.product_cards SET image_src = '/assets/img/cards/sticker-tabaka-holo.jpg'
  WHERE product_type = 'sticker' AND key = 'hologram-sayfa';

UPDATE public.product_cards SET image_src = '/assets/img/cards/sticker-tabaka-simli.jpg'
  WHERE product_type = 'sticker' AND key = 'simli-sayfa';
