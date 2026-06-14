-- ============================================================
-- Migration 180: FAZ 1 paylaşılan altyapı
--   • fn_transition_order_status (CAS + matris + event + audit)
--   • fn_with_advisory_lock / fn_release_advisory_lock
--   • order_events.idempotency_key
--   • coupon_uses (coupon_id, user_id) unique (per_user_limit=1 yarış koruması)
--   • cron_runs tek "running" satırı (belt-and-suspenders)
-- ============================================================

-- ---------- order_events idempotency ----------
ALTER TABLE public.order_events
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS order_events_idempotency_unique
  ON public.order_events (order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------- coupon_uses yarış koruması ----------
-- per_user_limit=1 kuponlarda çift insert engeli (çoğu kampanya kuponu limit=1).
-- per_user_limit IS NULL (sınırsız) kuponlarda bu index uygulanmamalı — şu an aktif
-- sınırsız kupon yok; gerekirse FAZ 2'de kaldırılır veya predicate eklenir.
CREATE UNIQUE INDEX IF NOT EXISTS coupon_uses_coupon_user_unique
  ON public.coupon_uses (coupon_id, user_id);

-- ---------- cron_runs tek running ----------
CREATE UNIQUE INDEX IF NOT EXISTS cron_runs_one_running_per_name
  ON public.cron_runs (cron_name)
  WHERE status = 'running';

-- ---------- Geçiş matrisi (forward) ----------
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
    WHEN 'awaiting_upload' THEN p_to IN ('qc_pending', 'cancelled')
    WHEN 'qc_pending' THEN p_to IN (
      'proof_generating', 'human_review', 'qc_flagged', 'cancelled'
    )
    WHEN 'qc_flagged' THEN p_to IN ('human_review', 'cancelled')
    WHEN 'human_review' THEN p_to IN (
      'proof_generating', 'human_review_failed', 'cancelled'
    )
    WHEN 'human_review_failed' THEN p_to IN ('qc_pending', 'cancelled')
    WHEN 'proof_generating' THEN p_to IN ('proof_pending', 'human_review')
    WHEN 'proof_pending' THEN p_to IN ('proof_approved', 'cancelled')
    WHEN 'proof_validating' THEN p_to IN (
      'proof_pending', 'operator_review', 'cancelled'
    )
    WHEN 'proof_approved' THEN p_to IN (
      'ready_to_ship', 'operator_print_review'
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

CREATE OR REPLACE FUNCTION public.fn_is_valid_order_bulk_transition(
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
    WHEN 'paid' THEN p_to IN ('qc_pending', 'cancelled')
    WHEN 'awaiting_upload' THEN p_to = 'cancelled'
    WHEN 'qc_pending' THEN p_to IN (
      'proof_generating', 'human_review', 'cancelled'
    )
    WHEN 'proof_pending' THEN p_to IN (
      'proof_validating', 'proof_approved', 'cancelled'
    )
    WHEN 'proof_validating' THEN p_to IN (
      'proof_pending', 'operator_review', 'cancelled'
    )
    WHEN 'proof_approved' THEN p_to IN (
      'ready_to_ship', 'operator_print_review'
    )
    WHEN 'operator_print_review' THEN p_to IN (
      'ready_to_ship', 'proof_generating', 'cancelled'
    )
    WHEN 'ready_to_ship' THEN p_to = 'in_production'
    WHEN 'in_production' THEN p_to = 'shipped'
    WHEN 'shipped' THEN p_to = 'delivered'
    ELSE false
  END;
END;
$$;

-- ---------- Advisory lock (cron tek-instance) ----------
CREATE OR REPLACE FUNCTION public.fn_with_advisory_lock(p_key text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
BEGIN
  RETURN pg_try_advisory_lock(hashtext('pim:' || p_key));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_release_advisory_lock(p_key text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext('pim:' || p_key));
END;
$$;

-- ---------- Merkezi sipariş status geçişi ----------
CREATE OR REPLACE FUNCTION public.fn_transition_order_status(
  p_order_id text,
  p_to_status public.order_status,
  p_from_status public.order_status[] DEFAULT NULL,
  p_mode text DEFAULT 'forward',
  p_actor_id uuid DEFAULT NULL,
  p_actor_role text DEFAULT 'system',
  p_event_type text DEFAULT 'status_changed',
  p_summary text DEFAULT '',
  p_detail jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL,
  p_audit_action text DEFAULT NULL,
  p_audit_summary text DEFAULT NULL,
  p_audit_detail jsonb DEFAULT '{}'::jsonb,
  p_actor_email text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from public.order_status;
  v_rows int;
  v_event_id uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id
      FROM public.order_events
      WHERE order_id = p_order_id
        AND idempotency_key = p_idempotency_key
      LIMIT 1;
    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'from_status', v_from,
        'to_status', p_to_status
      );
    END IF;
  END IF;

  SELECT status INTO v_from
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p_from_status IS NOT NULL AND NOT (v_from = ANY (p_from_status)) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'stale_from',
      'from_status', v_from
    );
  END IF;

  IF v_from = p_to_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'from_status', v_from,
      'to_status', p_to_status
    );
  END IF;

  IF p_mode = 'compensating' THEN
    -- rollback / telafi — matris kontrolü yok
    NULL;
  ELSIF p_mode = 'admin_override' THEN
    IF v_from = 'delivered' AND p_to_status <> 'delivered' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'terminal', 'from_status', v_from);
    END IF;
    IF v_from = 'cancelled' AND p_to_status <> 'cancelled' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'terminal', 'from_status', v_from);
    END IF;
  ELSIF p_mode = 'bulk' THEN
    IF NOT public.fn_is_valid_order_bulk_transition(v_from, p_to_status) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'invalid_transition',
        'from_status', v_from,
        'to_status', p_to_status
      );
    END IF;
  ELSE
    IF NOT public.fn_is_valid_order_forward_transition(v_from, p_to_status) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'invalid_transition',
        'from_status', v_from,
        'to_status', p_to_status
      );
    END IF;
  END IF;

  UPDATE public.orders
    SET status = p_to_status,
        updated_at = now()
    WHERE id = p_order_id
      AND status = v_from;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_from', 'from_status', v_from);
  END IF;

  INSERT INTO public.order_events (
    order_id,
    event_type,
    status_after,
    actor_id,
    actor_role,
    summary,
    detail,
    idempotency_key
  ) VALUES (
    p_order_id,
    p_event_type,
    p_to_status,
    p_actor_id,
    p_actor_role,
    COALESCE(NULLIF(trim(p_summary), ''), 'Status: ' || v_from::text || ' → ' || p_to_status::text),
    COALESCE(p_detail, '{}'::jsonb),
    p_idempotency_key
  );

  IF p_audit_action IS NOT NULL AND trim(p_audit_action) <> '' THEN
    INSERT INTO public.audit_log (
      actor_id,
      actor_email,
      actor_role,
      action,
      target_type,
      target_id,
      summary,
      detail,
      ip_address,
      user_agent
    ) VALUES (
      p_actor_id,
      p_actor_email,
      CASE
        WHEN p_actor_role IN ('admin', 'staff', 'customer', 'system') THEN p_actor_role
        ELSE 'system'
      END,
      p_audit_action::public.audit_action,
      'order',
      p_order_id,
      COALESCE(NULLIF(trim(p_audit_summary), ''), COALESCE(NULLIF(trim(p_summary), ''), 'Status change')),
      COALESCE(p_audit_detail, p_detail, '{}'::jsonb),
      NULLIF(trim(p_ip_address), '')::inet,
      NULLIF(trim(p_user_agent), '')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_from,
    'to_status', p_to_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_is_valid_order_forward_transition(
  public.order_status, public.order_status
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_is_valid_order_bulk_transition(
  public.order_status, public.order_status
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_with_advisory_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_release_advisory_lock(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.fn_transition_order_status(
  text, public.order_status, public.order_status[], text,
  uuid, text, text, text, jsonb, text,
  text, text, jsonb, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_with_advisory_lock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_release_advisory_lock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transition_order_status(
  text, public.order_status, public.order_status[], text,
  uuid, text, text, text, jsonb, text,
  text, text, jsonb, text, text, text
) TO service_role;

COMMENT ON FUNCTION public.fn_transition_order_status IS
  'FAZ 1 — orders.status tek chokepoint: CAS + matris + order_events + audit tek transaction.';
