-- Migration 152: Sticker sayfa grubu (Grid 1) sıralama — 2 yeni kartı en üste al.
-- Sefa (4 Haz). Tekli sticker grubu (sort 1-11) DOKUNULMAZ. Sadece sort_order.

UPDATE public.product_cards SET sort_order = 12 WHERE product_type='sticker' AND key='ozel-sayfa';
UPDATE public.product_cards SET sort_order = 13 WHERE product_type='sticker' AND key='seffaf-sayfa';
UPDATE public.product_cards SET sort_order = 14 WHERE product_type='sticker' AND key='sheet';
UPDATE public.product_cards SET sort_order = 15 WHERE product_type='sticker' AND key='yuvarlak-sayfa';
UPDATE public.product_cards SET sort_order = 16 WHERE product_type='sticker' AND key='kare-sayfa';
UPDATE public.product_cards SET sort_order = 17 WHERE product_type='sticker' AND key='dikdortgen-sayfa';
UPDATE public.product_cards SET sort_order = 18 WHERE product_type='sticker' AND key='hologram-sayfa';
UPDATE public.product_cards SET sort_order = 19 WHERE product_type='sticker' AND key='simli-sayfa';
