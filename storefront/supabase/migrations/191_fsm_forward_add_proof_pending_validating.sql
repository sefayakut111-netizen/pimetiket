-- Mig 191: forward matrise proof_pending->proof_validating ekle (orchestrator after-edit re-validation).
--   verify:fsm guard yakaladı. bulk'ta zaten vardı; forward'a hizalandı. Zincir tamam:
--   proof_pending->proof_validating->proof_generating(mig190)->proof_pending(mevcut).
CREATE OR REPLACE FUNCTION public.fn_is_valid_order_forward_transition(
  p_from public.order_status,
  p_to public.order_status
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN false;
  END IF;
  RETURN CASE p_from
    WHEN 'paid' THEN p_to IN ('qc_pending', 'awaiting_upload', 'cancelled')
    WHEN 'awaiting_upload' THEN p_to IN ('qc_pending', 'proof_pending', 'cancelled')
    WHEN 'qc_pending' THEN p_to IN (
      'proof_generating', 'human_review', 'qc_flagged',
      'ready_to_ship', 'human_review_failed', 'proof_pending', 'cancelled'
    )
    WHEN 'qc_flagged' THEN p_to IN (
      'human_review', 'ready_to_ship', 'proof_generating',
      'human_review_failed', 'proof_pending', 'cancelled'
    )
    WHEN 'human_review' THEN p_to IN (
      'proof_generating', 'human_review_failed', 'ready_to_ship', 'cancelled'
    )
    WHEN 'human_review_failed' THEN p_to IN (
      'qc_pending', 'ready_to_ship', 'proof_generating', 'cancelled'
    )
    WHEN 'proof_generating' THEN p_to IN (
      'proof_pending', 'human_review', 'operator_review'
    )
    -- proof_pending: + proof_validating (orchestrator after-edit). in_production/operator_review YOK (proof-respond legacy).
    WHEN 'proof_pending' THEN p_to IN ('proof_approved', 'proof_validating', 'cancelled')
    WHEN 'proof_validating' THEN p_to IN (
      'proof_pending', 'operator_review', 'proof_generating', 'cancelled'
    )
    WHEN 'proof_approved' THEN p_to IN ('ready_to_ship', 'operator_print_review')
    WHEN 'operator_review' THEN p_to IN (
      'proof_validating', 'proof_pending', 'cancelled'
    )
    WHEN 'operator_print_review' THEN p_to IN (
      'ready_to_ship', 'proof_generating', 'cancelled'
    )
    WHEN 'ready_to_ship' THEN p_to IN ('in_production', 'fason_assigned')
    WHEN 'fason_assigned' THEN p_to = 'in_production'
    WHEN 'in_production' THEN p_to = 'shipped'
    WHEN 'shipped' THEN p_to = 'delivered'
    WHEN 'delivered' THEN false
    WHEN 'cancelled' THEN false
    ELSE false
  END;
END;
$$;

COMMENT ON FUNCTION public.fn_is_valid_order_forward_transition IS
  'Mig 191 — proof_pending->proof_validating forward (orchestrator after-edit). Mig 190 route hizalama korunur.';
