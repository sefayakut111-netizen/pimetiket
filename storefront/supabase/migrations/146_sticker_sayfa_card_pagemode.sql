-- Migration 146: "Sticker Sayfası" kartını sayfa-boyutu moduna aç (?sayfa=1)
--
-- Sefa 3 Haz 2026: Sayfa-boyutu modeli (hazır A4/A5… sayfa boyutu seçici, fiyat
-- sayfa alanından) SADECE "Sticker Sayfası" ürününe (key='sheet') açılır.
-- Diğer tabaka kartları (yuvarlak/kare/dikdortgen/hologram/simli-sayfa, kilit=tabaka,
-- Mig 137) DOKUNULMAZ — onlar "tabaka dizilim, adete göre min-fire" modeli, AYRI iş.
--
-- query_params JSONB'sine "sayfa":"1" eklenir → buildCardQueryString
-- ".../yapilandir?cut=tabaka&shape=square&sayfa=1" üretir → konfigüratör isSayfaMode=true.
-- Idempotent: jsonb || merge, tekrar çalışsa da aynı sonuç.

update public.product_cards
set query_params = query_params || '{"sayfa":"1"}'::jsonb
where product_type = 'sticker'
  and key = 'sheet';
