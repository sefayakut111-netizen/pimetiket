-- ============================================================
-- Pim Etiket — Migration 019: order_events CHECK constraint genişletme
--
-- Önceki Migration 013-018'de eklenen event_type'lar mevcut CHECK
-- constraint'e takılıyordu (silent fail). Şimdi düzeltiyoruz.
-- Fason aktarım için yeni event'lar da eklendi.
-- ============================================================

-- Eski constraint drop
alter table public.order_events
  drop constraint if exists order_events_event_type_check;

-- Yeni constraint — tüm event_type'ları içerir
alter table public.order_events
  add constraint order_events_event_type_check
  check (event_type = any (array[
    -- Orijinal event'ler (Migration 002)
    'created',
    'paid',
    'file_uploaded',
    'qc_passed',
    'qc_flagged',
    'operator_reviewed',
    'proof_generated',
    'proof_approved',
    'proof_rejected',
    'production_started',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
    'note_added',

    -- Migration 013 (manuel sipariş)
    'order_created_manual',

    -- Migration 014 (prova upload)
    'proof_uploaded',
    'proof_change_requested',

    -- Migration 017 (otomatik iade)
    'auto_refund_stale_proof',

    -- Generic status update (API endpoint)
    'status_changed',

    -- Migration 018 (fason aktarım)
    'fason_assigned',          -- Sefa fason'a atadı
    'fason_mail_queued',       -- Mail outbox'a alındı
    'fason_mail_sent',         -- Resend başarılı
    'fason_mail_failed',       -- Resend hata
    'fason_link_accessed',     -- Fason linki açtı
    'fason_acknowledged',      -- Fason "üretime aldım" dedi
    'fason_in_production',     -- Üretime girdi
    'fason_ready',             -- Hazır, kargoya
    'fason_shipped',           -- Kargoya verildi
    'fason_issue_reported',    -- Fason sorun bildirdi
    'fason_cancelled'          -- Fason atama iptal
  ]));
