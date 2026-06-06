-- Mig 161: order_events — print_ready_failed event_type (denetim fix #1)
-- proof/finalize print-ready hata izi CHECK'te yoktu → insert sessiz fail.

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
    'coupon_apply_failed',
    'print_ready_failed'
  ]));
