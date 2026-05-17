-- Sefa 17 May v36: 6 yorumun photos array'i güncellendi.
-- 4 yorum → görsel atandı, 2 yorum → boş array (görsel yok).
-- Path formatı: { "path": "/reviews/X.jpg" } — local public/ klasörü.

-- A.K. → sabun-kraft.jpg (Nature's Harvest Lavender soap kraft etiket)
update public.reviews
set photos = '[{"path":"/reviews/sabun-kraft.jpg"}]'::jsonb
where display_name = 'A.K.' and product_type = 'etiket';

-- C.D. → zeytinyagi-sise.jpg (Olive Blossom zeytinyağı şişesi)
update public.reviews
set photos = '[{"path":"/reviews/zeytinyagi-sise.jpg"}]'::jsonb
where display_name = 'C.D.' and product_type = 'etiket';

-- M.S. → krem-kavanoz.jpg (Velour Cosmetics krem kavanozu)
update public.reviews
set photos = '[{"path":"/reviews/krem-kavanoz.jpg"}]'::jsonb
where display_name = 'M.S.' and product_type = 'etiket';

-- B.Y. → laptop-hologram.jpg (Laptop kapağında hologram stickerlar)
update public.reviews
set photos = '[{"path":"/reviews/laptop-hologram.jpg"}]'::jsonb
where display_name = 'B.Y.' and product_type = 'sticker';

-- N.G. → görsel yok → boş array
update public.reviews
set photos = '[]'::jsonb
where display_name = 'N.G.' and product_type = 'sticker';

-- E.A. → görsel yok → boş array
update public.reviews
set photos = '[]'::jsonb
where display_name = 'E.A.' and product_type = 'sticker';

-- Doğrulama
select display_name, product_type, photos
from public.reviews
where status = 'published' and show_on_homepage = true
order by created_at desc;
