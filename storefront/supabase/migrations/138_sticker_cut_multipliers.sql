-- Migration 138: Sticker fiyatına "kesim türü çarpanı" (cut_multipliers) ekle
--
-- Sefa 1 Haz 2026: "kisscut ile diecut arasında kesim farkından ötürü 1.10 fiyat farkı olacak,
-- diecut daha pahalı; fiyatlar kısmına kesim seçeneği koy oranı elle belirleyebileyim."
--
-- ProfileConfig.cut_multipliers (JSONB) → calculatePrice'ta uygulanır. Admin /api/admin/pricing
-- üzerinden düzenlenebilir. VARSAYILAN: diecut 1.10 (kisscut'a göre %10 pahalı), kisscut 1.00, tabaka 1.00.
--
-- DİKKAT (gelir etkisi): Bu varsayılanla mevcut DIECUT sticker fiyatları %10 ARTAR (kisscut/tabaka aynı kalır).
-- Sefa diecut'u sabit tutup kisscut'ı düşürmek isterse admin'den diecut=1.00 / kisscut≈0.91 yapabilir.
-- Sadece scope='sticker'. Etiket etkilenmez.

UPDATE public.pricing_config
SET
  draft_config = jsonb_set(
    draft_config, '{cut_multipliers}',
    '{"diecut": 1.10, "kisscut": 1.00, "tabaka": 1.00}'::jsonb, true
  ),
  live_config = jsonb_set(
    live_config, '{cut_multipliers}',
    '{"diecut": 1.10, "kisscut": 1.00, "tabaka": 1.00}'::jsonb, true
  )
WHERE scope = 'sticker';
