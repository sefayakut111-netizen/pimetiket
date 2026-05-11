-- ============================================================
-- Pim Etiket — Migration 031: Demo Seed Yorumları
--
-- Sefa kararı 11 May (Madde 7):
--   "6 adet silinmeyen fake yorum, 1'er adette resim koyacağız.
--    Sistem açıldıktan sonra kaldırız."
--
-- TKHK m.61 yanıltıcı reklam riski azaltma:
--   - is_demo_seed=true flag — site canlı kullanım fazına geçince
--     tek SQL ile silinir: DELETE FROM reviews WHERE is_demo_seed = true;
--   - Kişi fotoğrafı YOK (sadece ürün/atölye görseli)
--   - Display name kısa ve jenerik (sadece initials)
--   - Hiç abartılı dil ("muhteşem", "%100 garanti") YASAK
--   - photos: placeholder URL'ler, Sefa upload edince swap eder
--
-- Şema değişimi:
--   - user_id ve order_id NULLABLE (sadece is_demo_seed=true için)
--   - is_demo_seed boolean default false
--   - CHECK: regular yorum için her ikisi de NOT NULL kalmalı
-- ============================================================

-- ---------- Şema değişimleri ----------
alter table public.reviews
  add column if not exists is_demo_seed boolean not null default false;

-- user_id ve order_id NULL'a izin ver (sadece demo seed için)
alter table public.reviews
  alter column user_id drop not null,
  alter column order_id drop not null;

-- CHECK: regular review (is_demo_seed=false) için user_id+order_id zorunlu
alter table public.reviews
  drop constraint if exists reviews_demo_seed_check;
alter table public.reviews
  add constraint reviews_demo_seed_check
  check (
    is_demo_seed = true
    or (user_id is not null and order_id is not null)
  );

-- Unique constraint (user_id, order_id) zaten var — NULL'lar UNIQUE'i etkilemez
-- (Postgres NULL != NULL kuralı). Demo seed çoğu NULL'lı olur, sorun yok.

create index if not exists reviews_is_demo_seed_idx
  on public.reviews(is_demo_seed)
  where is_demo_seed = true;

-- ---------- 6 Demo Seed Yorum ----------
-- Photos: /seed/reviews/N.jpg pattern. Sefa public-assets bucket'a
-- 1-6 numaralı ürün/atölye fotoğraflarını upload edecek.
-- Şu an boş array; HomeReviews component photos yoksa text-only gösterir.

insert into public.reviews (
  is_demo_seed, status, show_on_homepage, featured, rating,
  display_name, product_type, body, photos, created_at
) values
-- 1. Etiket — kraft, doğal kozmetik
(
  true, 'published', true, true, 5,
  'A.K.', 'etiket',
  'Doğal sabun markamız için kraft etiket bastırdık. Hem ölçü hem de kaplama beklediğimizden iyi. Kargo da hızlıydı, ekibe teşekkürler.',
  '["seed/reviews/1.jpg"]'::jsonb,
  now() - interval '12 days'
),
-- 2. Sticker — vinil, kişisel
(
  true, 'published', true, false, 5,
  'B.Y.', 'sticker',
  'Laptop kapağına yapıştırmak için 50 adet die-cut sticker. Renkler ekranda gördüğüm gibi çıktı, kenar kesimi temiz. 4 günde elime ulaştı.',
  '["seed/reviews/2.jpg"]'::jsonb,
  now() - interval '8 days'
),
-- 3. Etiket — ultra clear, zeytinyağı
(
  true, 'published', true, false, 4,
  'C.D.', 'etiket',
  'Cam şişede zeytinyağı için şeffaf etiket. Şişe üzerinde havada duruyor gibi görünüyor — istediğim etki bu. Adetlere uyum sağlandı, küçük tirajda kalite düşmedi.',
  '["seed/reviews/3.jpg"]'::jsonb,
  now() - interval '21 days'
),
-- 4. Sticker — holografik, etkinlik
(
  true, 'published', true, false, 5,
  'E.A.', 'sticker',
  'Doğum günü etkinliğimiz için holografik sticker. Çocuklar çok beğendi, ışıkta renkleri kayıyor. Sefa''ya whatsapptan sorduğum her şey için hızlı dönüş aldım.',
  '["seed/reviews/4.jpg"]'::jsonb,
  now() - interval '5 days'
),
-- 5. Etiket — soft touch, kozmetik
(
  true, 'published', true, true, 5,
  'M.S.', 'etiket',
  'Krem şişelerimiz için soft touch kaplama etiket. Premium hissi vermek istemiştik, dokunduğunda yumuşaklık tam istediğim gibi. Ölçü 5 mm yuvarlama sistemi pratik.',
  '["seed/reviews/5.jpg"]'::jsonb,
  now() - interval '15 days'
),
-- 6. Sticker — transparan, ürün ambalajı
(
  true, 'published', true, false, 4,
  'N.G.', 'sticker',
  'Kargo paketlerimi mühürlemek için yuvarlak şeffaf sticker. Tasarımım minimaldi, transparan zemin tam oldu. Hızlı baskı + güvenli ambalaj.',
  '["seed/reviews/6.jpg"]'::jsonb,
  now() - interval '3 days'
)
on conflict do nothing;

-- ============================================================
-- Migration 031 sonu
--
-- Site canlı kullanım fazına geçtiğinde TEK SQL ile silmek için:
--   DELETE FROM public.reviews WHERE is_demo_seed = true;
--
-- Görsel placeholder URL'leri (`seed/reviews/N.jpg`) Sefa
-- public-assets bucket'ına gerçek ürün fotoğraflarını yükledikçe
-- otomatik aktive olur. Şu an HomeReviews component photos boş ise
-- text-only render eder, 404 görsel hatasız degrade.
-- ============================================================
