-- ============================================================
-- Migration 082 — Sticker sheet kart adi: "Tabaka Sticker" → "Sticker Sayfası"
-- ============================================================
--
-- Sefa 22 May v68 (revize):
-- Mig 075'te "Sticker Sayfası" → "Tabaka Sticker" yapmıştık (Ürün denetim
-- P2 #15+#16: web sayfası izlenimi verir gerekçesiyle). Sefa şimdi geri
-- döndü — müşteri dilinde "sayfa" daha yaygın ve net.
--
-- Kod tarafında STICKER_CARDS array + yapilandir page label switch
-- "Sticker Sayfası" oldu. Bu migration DB ile aynı hizaya getirir.
--
-- ============================================================

update public.product_cards set
  title_tr = 'Sticker Sayfası'
where product_type = 'sticker' and key = 'sheet';

-- Doğrulama:
--   SELECT key, title_tr FROM public.product_cards
--   WHERE product_type='sticker' AND key='sheet';
--   Beklenen: title_tr = 'Sticker Sayfası'
