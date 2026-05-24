-- ============================================================
-- Pim Etiket — Migration 087: Customer Audit Actions
-- ============================================================
--
-- Sefa 23 May v68. Güvenlik analizi P0.4 — Grup D (Customer
-- endpoint'leri yeniden yazımı).
-- Tam liste: memory/project_security_findings_2026_05_23.md
--
-- Sorun:
--   /api/admin/customers/[id]/* endpoint'lerinin tamamı export
--   CSV handler'ının bire bir kopyasıydı. UI'daki "not ekle",
--   "şifre sıfırla", "hesap dondur", "tag ekle", "mail gönder"
--   butonları aslında CSV indiriyordu. Grup D sıfırdan implement
--   ediyor.
--
--   Yeni endpoint'ler audit_log'a yazmak istiyor. Mig 004
--   audit_action enum'unda customer.* aksiyonları yok — endpoint
--   audit INSERT'leri 22P02 (invalid_text_representation) ile
--   patlar. Bu migration eksik enum değerlerini ekliyor.
--
-- Çözüm:
--   Eksik audit_action enum değerlerini IDEMPOTENT ekle.
--   IMPORTANT: Bu migration deploy edilmeden TS compiler hata
--   vermez (audit_log.action text-cast olarak görünür) ama
--   runtime'da Postgres 22P02 fırlatır.
--
-- Sefa 23 May v68
-- ============================================================

-- Not ekle / sil (customer_notes mutation)
alter type public.audit_action add value if not exists 'customer.note_add';
alter type public.audit_action add value if not exists 'customer.note_delete';

-- Tag ekle / kaldır (customer_tags mutation)
alter type public.audit_action add value if not exists 'customer.tag_add';
alter type public.audit_action add value if not exists 'customer.tag_remove';

-- Hesap dondurma / açma (auth.users.banned_until)
alter type public.audit_action add value if not exists 'customer.suspend';
alter type public.audit_action add value if not exists 'customer.unsuspend';

-- Şifre sıfırlama maili tetikle
alter type public.audit_action add value if not exists 'customer.reset_password';

-- Custom email gönder (admin → müşteri)
alter type public.audit_action add value if not exists 'customer.email_sent';

-- Müşteri 360° görüntüleme (KVKK gereği view audit)
alter type public.audit_action add value if not exists 'customer.view_360';

-- ============================================================
-- Migration 087 sonu
-- ============================================================
-- Rollback:
--   Postgres ALTER TYPE ... ADD VALUE geri alınamaz (enum value
--   silinemez). Geri sarmak gerekirse:
--     1. audit_log içindeki customer.* satırlarını text'e cast et
--        ve farklı action'a remap
--     2. yeni enum tipi oluştur, eski'yi drop et
--   Production'da rollback yapma — append-only audit zincirini
--   bozar.
