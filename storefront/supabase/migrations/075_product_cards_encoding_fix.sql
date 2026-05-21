-- ============================================================
-- Migration 075 — product_cards encoding cleanup + isim güncellemesi
-- ============================================================
--
-- ⏳ APPLY ONAYI BEKLİYOR (Sefa kuralı: production DB write per-action onay)
--
-- Sefa "Migration 075'i uygula" diyince:
--   Option A) Supabase Dashboard → SQL Editor → bu dosyayı paste + Run
--   Option B) `npx supabase db push --linked` (tüm pending migrations)
--   Option C) `psql $SUPABASE_DB_URL -f 075_product_cards_encoding_fix.sql`
--
-- Tahmini süre: <2 saniye (22 UPDATE statement, indexed key).
-- Rollback: yok — UPDATE'ler idempotent, tekrar çalıştırılabilir, eski
-- bozuk değerleri istersen `git show acea2b1 -- src/app/sticker/page.tsx`
-- ile geri çıkarabilirsin.
--
-- Doğrulama (apply sonrası):
--   SELECT key, title_tr FROM product_cards
--   WHERE title_tr LIKE '%' || chr(65533) || '%';
--   -- Boş dönmeli (replacement char artık yok).
--
-- ============================================================
--
-- Sefa 21 May v68 (Site denetim P0 #1 + Ürün denetim P2 #15 takip):
--
-- Migration 074 production'a uygulanırken bazı Türkçe karakterler
-- bozuk yazılmış (U+FFFD replacement character "�"). Site /etiket
-- ve /sticker liste sayfalarında "�zel Kesim", "Sil�etine", "D�z"
-- gibi metinler gözüküyordu. Client-side hasBrokenEncoding guard
-- aktifti (kullanıcı fallback hardcoded array görüyordu), ama DB'nin
-- kendisi yine de düzeltilmeli — admin /admin/urunler sayfasında
-- ham veri yönetiliyor.
--
-- Ayrıca v68 ürün denetim P2 #15+#16'da "Sticker Sayfası" → "Tabaka
-- Sticker" olarak güncellendi (TS kaynağında); DB ile aynı hizaya
-- getirilir.
--
-- Bu migration tüm 22 satırı UPDATE eder (INSERT yok, eğer key yoksa
-- güncellenmez — manuel ek). On conflict yok, doğrudan UPDATE … WHERE
-- pattern'i. Idempotent: birden fazla kez çalıştırılabilir.
--
-- Rollback: 074'teki orijinal seed değerlerine geri dönmek isterseniz,
-- 074 dosyasındaki INSERT VALUES bloğundaki text'leri buradaki gibi
-- UPDATE olarak yazıp tekrar çalıştırın.
-- ============================================================

-- Etiket Rulo (6)
update public.product_cards set
  title_tr = 'Özel Kesim Rulo Etiket',
  desc_tr  = 'Logo veya tasarımın silüetine kesim'
where product_type = 'etiket' and key = 'rulo-diecut';

update public.product_cards set
  title_tr = 'Şeffaf Rulo Etiket',
  desc_tr  = 'Saydam zemin — cam şişe, parfüm'
where product_type = 'etiket' and key = 'rulo-clear';

update public.product_cards set
  title_tr = 'Yuvarlak Rulo Etiket',
  desc_tr  = 'Daire — kapak, kozmetik klasiği'
where product_type = 'etiket' and key = 'rulo-circle';

update public.product_cards set
  title_tr = 'Kare Rulo Etiket',
  desc_tr  = 'Eş kenar — düz veya yumuşak köşe'
where product_type = 'etiket' and key = 'rulo-square';

update public.product_cards set
  title_tr = 'Dikdörtgen Rulo Etiket',
  desc_tr  = 'Yaygın etiket formu — düz veya yumuşak köşe'
where product_type = 'etiket' and key = 'rulo-rectangle';

update public.product_cards set
  title_tr = 'Oval Rulo Etiket',
  desc_tr  = 'Elips — vintage, şık duruş'
where product_type = 'etiket' and key = 'rulo-oval';

-- Etiket Tabaka (5)
update public.product_cards set
  title_tr = 'Yuvarlak Tabaka Etiket',
  desc_tr  = 'Düşük adet daire — hediye, butik'
where product_type = 'etiket' and key = 'tabaka-circle';

update public.product_cards set
  title_tr = 'Özel Kesim Tabaka Etiket',
  desc_tr  = 'Düşük adet kontur — el yapımı, butik'
where product_type = 'etiket' and key = 'tabaka-diecut';

update public.product_cards set
  title_tr = 'Oval Tabaka Etiket',
  desc_tr  = 'Düşük adet oval kesim'
where product_type = 'etiket' and key = 'tabaka-oval';

update public.product_cards set
  title_tr = 'Dikdörtgen Tabaka Etiket',
  desc_tr  = 'Düşük adet — düz veya yumuşak köşe'
where product_type = 'etiket' and key = 'tabaka-rectangle';

update public.product_cards set
  title_tr = 'Kare Tabaka Etiket',
  desc_tr  = 'Düşük adet — düz veya yumuşak köşe'
where product_type = 'etiket' and key = 'tabaka-square';

-- Sticker (11)
update public.product_cards set
  title_tr = 'Özel Kesim Sticker',
  desc_tr  = 'Logo veya tasarımın silüetine kesim'
where product_type = 'sticker' and key = 'diecut';

update public.product_cards set
  title_tr = 'Yuvarlak Sticker',
  desc_tr  = 'Daire form — laptop, su şişesi, marka'
where product_type = 'sticker' and key = 'circle';

update public.product_cards set
  title_tr = 'Dikdörtgen Sticker',
  desc_tr  = 'Yaygın form — düz veya yumuşak köşe'
where product_type = 'sticker' and key = 'rectangle';

update public.product_cards set
  title_tr = 'Kare Sticker',
  desc_tr  = 'Eş kenar — düz veya yumuşak köşe'
where product_type = 'sticker' and key = 'square';

update public.product_cards set
  title_tr = 'Oval Sticker',
  desc_tr  = 'Elips — vintage, organik form'
where product_type = 'sticker' and key = 'oval';

update public.product_cards set
  title_tr = 'Bumper Sticker',
  desc_tr  = 'Uzun yatay — hobi, laptop'
where product_type = 'sticker' and key = 'bumper';

update public.product_cards set
  title_tr = 'Yarı Kesim Sticker',
  desc_tr  = 'Çevresi sağlam kağıttan tek tek çıkarılır'
where product_type = 'sticker' and key = 'kisscut';

update public.product_cards set
  title_tr = 'Şeffaf Sticker',
  desc_tr  = 'Saydam zemin — cam, arka plan görünsün'
where product_type = 'sticker' and key = 'clear';

update public.product_cards set
  title_tr = 'Holografik Sticker',
  desc_tr  = 'Gökkuşağı yansıma — premium, etkinlik'
where product_type = 'sticker' and key = 'holo';

update public.product_cards set
  title_tr = 'Simli Sticker',
  desc_tr  = 'Parıltılı dokulu — çocuk, hediye'
where product_type = 'sticker' and key = 'glitter';

-- Ürün denetim P2 #15+#16: "Karma Sticker Sayfası" → "Tabaka Sticker"
update public.product_cards set
  title_tr = 'Tabaka Sticker',
  desc_tr  = 'Aynı tasarımdan çok adet — tek tabakada'
where product_type = 'sticker' and key = 'sheet';

-- Doğrulama sorgusu (apply sonrası manuel çalıştır):
--   select key, title_tr from product_cards
--   where title_tr like '%' || chr(65533) || '%';
-- Boş dönmeli (replacement char artık yok).
