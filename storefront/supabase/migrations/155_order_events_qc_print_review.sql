-- ============================================================
-- Migration 155: order_events event_type — AI QC + baskı öncesi onay
-- qc_* audit trail (ai-qc decide) + print_review_* (FAZ 3)
-- ============================================================

alter table public.order_events
  drop constraint if exists order_events_event_type_check;

alter table public.order_events
  add constraint order_events_event_type_check
  check (event_type = any (array[
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
    'print_review_cancelled'
  ]));
