-- ============================================================
-- Pim Etiket — Migration 015: Cüzdan Sistemi KALDIRIYORUZ
--
-- Sefa kararı (10 Mayıs 2026, akşam):
-- "Cüzdan yok" — kod ve DB tarafından tamamen silinecek.
--
-- Mantık:
--   - B2B niş baskı sektöründe (Sticker Mule, MOO, Vistaprint) cüzdan
--     standart değil; bizim de olması gereksiz
--   - "Tek kullanımlı ön ödemeli enstrüman" kuralları gri alan
--   - Mali müşavir maliyetini artırır, BDDK sorgusu doğurabilir
--   - Yerine alternatif kazanç sistemleri (referans/VIP/tekrar baskı
--     indirimi) gelir — ileride ayrı migration ile
--
-- Drop sırası (foreign key ilişkileri için):
--   1. wallet_transactions tablosu drop
--   2. RLS policy + index otomatik drop edilir
--
-- ÖNEMLİ: Bu migration push edilmeden ÖNCE row count kontrol yapıldı,
-- tablo boş (0 satır). Veri kaybı yok.
-- ============================================================

drop table if exists public.wallet_transactions cascade;

-- ============================================================
-- Migration 015 sonu
-- ============================================================
