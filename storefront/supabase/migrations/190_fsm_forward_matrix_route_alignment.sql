-- ============================================================
-- Migration 190: FSM forward matris — route gerçeğine hizalama (Seçenek A)
--   Mig 180 merkezileştirmesi sonrası matris route'tan dar kaldı.
--   Bu migration SADECE fn_is_valid_order_forward_transition'ı genişletir.
--   Eklenenler: §1 doğrulanmış route geçişleri + operator_review ölü-uç çıkışları.
--   EKLENMEYENLER (kasıtlı): proof_pending->in_production / ->operator_review
--     (proof-respond ölü/legacy, kod-fix ile kaldırılır),
--     paid->proof_pending (compensating mode'a bırakıldı, cutline-guard route'ta).
--   fn_is_valid_order_bulk_transition DEĞİŞMEZ (tüm bulk çiftleri zaten karşılı).
-- ============================================================

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
    WHEN 'paid' THEN p_to IN (
      'qc_pending', 'awaiting_upload', 'cancelled'
    )
    -- awaiting_upload: + proof_pending (resume-order-pipeline, cutline mevcut stuck-resume)
    WHEN 'awaiting_upload' THEN p_to IN (
      'qc_pending', 'proof_pending', 'cancelled'
    )
    -- qc_pending: + ready_to_ship (ai-qc approve), human_review_failed (ai-qc reject),
    --             proof_pending (resume + upload-proof)
    WHEN 'qc_pending' THEN p_to IN (
      'proof_generating', 'human_review', 'qc_flagged',
      'ready_to_ship', 'human_review_failed', 'proof_pending', 'cancelled'
    )
    -- qc_flagged: + ready_to_ship (ai-qc approve), proof_generating (ai-qc fix_and_proof),
    --             human_review_failed (ai-qc reject), proof_pending (upload-proof)
    WHEN 'qc_flagged' THEN p_to IN (
      'human_review', 'ready_to_ship', 'proof_generating',
      'human_review_failed', 'proof_pending', 'cancelled'
    )
    -- human_review: + ready_to_ship (ai-qc approve)
    WHEN 'human_review' THEN p_to IN (
      'proof_generating', 'human_review_failed', 'ready_to_ship', 'cancelled'
    )
    -- human_review_failed: + ready_to_ship (ai-qc approve), proof_generating (ai-qc fix_and_proof + QC re-run)
    WHEN 'human_review_failed' THEN p_to IN (
      'qc_pending', 'ready_to_ship', 'proof_generating', 'cancelled'
    )
    -- proof_generating: + operator_review (orchestrator AI verdict=fail dalı)
    WHEN 'proof_generating' THEN p_to IN (
      'proof_pending', 'human_review', 'operator_review'
    )
    -- proof_pending: DEĞİŞMEZ. proof-respond ölü/legacy → kod-fix ile kaldırılıyor;
    --   in_production / operator_review BİLEREK EKLENMEDİ (kalite-kapısı + iade penceresi koruması).
    WHEN 'proof_pending' THEN p_to IN ('proof_approved', 'cancelled')
    -- proof_validating: + proof_generating (after-edit sonrası runProofPipeline adımı)
    WHEN 'proof_validating' THEN p_to IN (
      'proof_pending', 'operator_review', 'proof_generating', 'cancelled'
    )
    WHEN 'proof_approved' THEN p_to IN (
      'ready_to_ship', 'operator_print_review'
    )
    -- operator_review: ÖLÜ-UÇ ÇIKIŞLARI (giriş orchestrator AI-fail + proof_validating'ten gelir).
    --   proof_validating: after-edit doğrulama (orchestrator runProofValidationAfterEdit)
    --   proof_pending: operatör prova reupload (upload-proof)
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
  'Mig 190 — forward matris route gerçeğine hizalandı. operator_review çıkışları eklendi (ölü-uç kapatma). proof_pending->in_production/operator_review BİLEREK YOK (proof-respond legacy, kod-fix).';
