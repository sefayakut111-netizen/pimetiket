-- Mig 162: fn_finalize_proof — proof_approved → operator_print_review atomik (denetim fix #3)
-- Route'taki ikinci admin update kaldırıldı; tek transaction içinde tamamlanır.

CREATE OR REPLACE FUNCTION public.fn_finalize_proof(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order record;
  v_pending int;
  v_open_help int;
  v_rows int;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;
  IF v_order.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF v_order.status <> 'proof_pending' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_status',
      'current_status', v_order.status
    );
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.order_items
  WHERE order_id = p_order_id
    AND proof_status NOT IN ('approved');

  IF v_pending > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'pending_items',
      'pending_count', v_pending
    );
  END IF;

  SELECT count(*) INTO v_open_help
  FROM public.proof_help_requests
  WHERE order_id = p_order_id
    AND status IN ('open', 'in_progress');

  IF v_open_help > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'open_help_requests',
      'open_count', v_open_help
    );
  END IF;

  -- ATOMIC: proof_pending → proof_approved (çift onay koruması)
  UPDATE public.orders
     SET status = 'proof_approved',
         updated_at = now()
   WHERE id = p_order_id
     AND status = 'proof_pending';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_status',
      'current_status', v_order.status
    );
  END IF;

  INSERT INTO public.order_events (
    order_id, event_type, status_after, actor_id, actor_role, summary
  ) VALUES (
    p_order_id,
    'proof_approved',
    'proof_approved',
    v_uid,
    'customer',
    'Müşteri tüm baskı önizlemelerini onayladı, üretime hazır'
  );

  -- ATOMIC (aynı transaction): proof_approved → operator_print_review
  UPDATE public.orders
     SET status = 'operator_print_review',
         updated_at = now()
   WHERE id = p_order_id
     AND status = 'proof_approved';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'fn_finalize_proof: operator_print_review transition failed for %', p_order_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_status', 'operator_print_review');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_finalize_proof(text) TO authenticated;

COMMENT ON FUNCTION public.fn_finalize_proof(text) IS
  'Müşteri prova finalize — proof_pending → proof_approved → operator_print_review (tek transaction, Mig 162).';
