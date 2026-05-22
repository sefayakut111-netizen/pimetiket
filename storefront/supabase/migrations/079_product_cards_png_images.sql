-- ============================================================
-- Migration 079 — product_cards image_src SVG → PNG
-- ============================================================
--
-- ⏳ APPLY ONAYI BEKLİYOR (Sefa kuralı: production DB write per-action onay)
--
-- Sefa "Migration 079'u uygula" diyince:
--   Option A) Supabase Dashboard → SQL Editor → bu dosyayı paste + Run
--   Option B) `psql $SUPABASE_DB_URL -f 079_product_cards_png_images.sql`
--   Option C) Management API (PAT ile)
--
-- Tahmini süre: <1 saniye (22 UPDATE, indexed key).
-- Rollback: SVG path'lerine geri dönmek için 074 INSERT VALUES'a bak,
-- aynı UPDATE pattern'iyle eski path'i yaz.
--
-- Doğrulama (apply sonrası):
--   SELECT key, image_src FROM public.product_cards
--   WHERE product_type = 'etiket' OR product_type = 'sticker'
--   ORDER BY product_type, sort_order;
--   -- Hepsi /assets/img/cards/...png dönmeli (tabaka-oval hariç — SVG kalır).
--
-- ============================================================
--
-- Sefa 22 May v68:
-- Sefa illüstrasyon-tarzı PNG'ler hazırladı (cam kavanoz + Pim silüetli
-- sticker etc), tüm 22 kart için public/assets/img/cards/ altında. Code
-- tarafında imageSrc field'ları zaten güncellendi (etiket page + sticker
-- page). Bu migration DB image_src'i kod ile aynı hizaya getirir.
--
-- Sticker kartları için: önceden image_src=NULL, svg_id=enum idi
-- (Registry üzerinden inline SVG çiziliyordu). Şimdi image_src dolu;
-- svg_id NULL olur (fallback artık kod tarafında). product_cards_visual_one
-- constraint'i (image_src OR svg_id NOT NULL) korunur.
--
-- İstisna: tabaka-oval için Sefa illüstrasyon hazırlamadı (Sefa "eski SVG
-- kalsın" dedi). Onun image_src'i değiştirilmiyor.
--
-- ============================================================

-- ─── Etiket Rulo (6) ─────────────────────────────────────────
update public.product_cards
   set image_src = '/assets/img/cards/rulo-diecut.png'
 where product_type = 'etiket' and key = 'rulo-diecut';

update public.product_cards
   set image_src = '/assets/img/cards/rulo-clear.png'
 where product_type = 'etiket' and key = 'rulo-clear';

update public.product_cards
   set image_src = '/assets/img/cards/rulo-circle.png'
 where product_type = 'etiket' and key = 'rulo-circle';

update public.product_cards
   set image_src = '/assets/img/cards/rulo-square.png'
 where product_type = 'etiket' and key = 'rulo-square';

update public.product_cards
   set image_src = '/assets/img/cards/rulo-rectangle.png'
 where product_type = 'etiket' and key = 'rulo-rectangle';

update public.product_cards
   set image_src = '/assets/img/cards/rulo-oval.png'
 where product_type = 'etiket' and key = 'rulo-oval';

-- ─── Etiket Tabaka (4 — oval hariç) ──────────────────────────
update public.product_cards
   set image_src = '/assets/img/cards/tabaka-circle.png'
 where product_type = 'etiket' and key = 'tabaka-circle';

update public.product_cards
   set image_src = '/assets/img/cards/tabaka-diecut.png'
 where product_type = 'etiket' and key = 'tabaka-diecut';

-- tabaka-oval: ATLANIR (Sefa SVG fallback istedi)
-- update public.product_cards
--    set image_src = '/assets/img/cards/tabaka-oval.png'
--  where product_type = 'etiket' and key = 'tabaka-oval';

update public.product_cards
   set image_src = '/assets/img/cards/tabaka-rectangle.png'
 where product_type = 'etiket' and key = 'tabaka-rectangle';

update public.product_cards
   set image_src = '/assets/img/cards/tabaka-square.png'
 where product_type = 'etiket' and key = 'tabaka-square';

-- ─── Sticker (11) ────────────────────────────────────────────
-- Önceden image_src=NULL, svg_id=enum. Artık PNG ile çalışıyor;
-- svg_id NULL'a çekilir (kod tarafında inline SVG fallback yine de var
-- ama constraint ihlal olmasın diye image_src dolu kalır).
update public.product_cards
   set image_src = '/assets/img/cards/sticker-diecut.png', svg_id = null
 where product_type = 'sticker' and key = 'diecut';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-circle.png', svg_id = null
 where product_type = 'sticker' and key = 'circle';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-rectangle.png', svg_id = null
 where product_type = 'sticker' and key = 'rectangle';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-square.png', svg_id = null
 where product_type = 'sticker' and key = 'square';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-oval.png', svg_id = null
 where product_type = 'sticker' and key = 'oval';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-bumper.png', svg_id = null
 where product_type = 'sticker' and key = 'bumper';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-kisscut.png', svg_id = null
 where product_type = 'sticker' and key = 'kisscut';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-clear.png', svg_id = null
 where product_type = 'sticker' and key = 'clear';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-hologram.png', svg_id = null
 where product_type = 'sticker' and key = 'holo';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-glitter-holo.png', svg_id = null
 where product_type = 'sticker' and key = 'glitter';

update public.product_cards
   set image_src = '/assets/img/cards/sticker-sheet.png', svg_id = null
 where product_type = 'sticker' and key = 'sheet';

-- ─── Doğrulama sorgusu (apply sonrası manuel çalıştır) ───────
--
-- SELECT product_type, key, image_src, svg_id
--   FROM public.product_cards
--  ORDER BY product_type, sort_order;
--
-- Beklenen: 21 satırda image_src = /assets/img/cards/*.png,
--           tabaka-oval'de eski SVG path (/assets/svg/cards/tabaka-oval.svg).
--           Sticker satırlarında svg_id = NULL.
