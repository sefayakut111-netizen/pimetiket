-- Mig 159: Dead RPC güvenlik — fn_apply_coupon yetkisini kaldır (P2)
-- Imza Mig 141 ile doğrulandı: (text, numeric, uuid, text)
-- fn_apply_coupon_admin + fn_validate_coupon DOKUNULMADI.

REVOKE ALL ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) FROM authenticated;

COMMENT ON FUNCTION public.fn_apply_coupon(text, numeric, uuid, text) IS
  'DEAD — kullanılmıyor. Aktif yol: fn_apply_coupon_admin (callback). Yetki revoke edildi (güvenlik).';

-- order_events: kupon apply-fail telafi izi (P1)
ALTER TABLE public.order_events
  DROP CONSTRAINT IF EXISTS order_events_event_type_check;

ALTER TABLE public.order_events
  ADD CONSTRAINT order_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
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
    'order_created_manual',
    'proof_uploaded',
    'proof_change_requested',
    'auto_refund_stale_proof',
    'status_changed',
    'fason_assigned',
    'fason_mail_queued',
    'fason_mail_sent',
    'fason_mail_failed',
    'fason_link_accessed',
    'fason_acknowledged',
    'fason_in_production',
    'fason_ready',
    'fason_shipped',
    'fason_issue_reported',
    'fason_cancelled',
    'qc_approved',
    'qc_rejected',
    'qc_fixed_by_operator',
    'print_review_approved',
    'print_review_fix',
    'print_review_cancelled',
    'coupon_apply_failed'
  ]));
