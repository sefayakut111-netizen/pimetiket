-- ============================================================
-- Migration 106 — Design upload trigger düzeltmesi
--
-- Sorun: Mig 062 trigger'ı design_files INSERT'te ateşleniyor
-- ve order status'unu proof_generating'e çekiyor. QC henüz
-- çalışmamış — status qc_pending olmalı (QC'yi bekle).
--
-- Düzeltme: awaiting_upload → qc_pending (proof_generating DEĞİL)
-- QC tamamlanınca run-order-qc.ts status'u proof_generating
-- veya human_review'a çeker.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_design_uploaded_advance_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id text;
  v_current_status text;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_order_id := NEW.order_id;

  IF v_order_id IS NULL AND NEW.order_item_id IS NOT NULL THEN
    SELECT oi.order_id INTO v_order_id
    FROM public.order_items oi
    WHERE oi.id = NEW.order_item_id;
  END IF;

  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text INTO v_current_status
  FROM public.orders
  WHERE id = v_order_id;

  IF v_current_status = 'awaiting_upload' THEN
    UPDATE public.orders
    SET status = 'qc_pending', updated_at = now()
    WHERE id = v_order_id;

    INSERT INTO public.order_events (
      order_id, event_type, status_after, actor_role, summary
    ) VALUES (
      v_order_id,
      'design_uploaded_status_advance',
      'qc_pending',
      'system',
      'Tasarım yüklendi — AI kalite kontrolü başlatılıyor'
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_design_uploaded_advance_status IS
  'awaiting_upload → qc_pending (QC tamamlanana kadar proof_generating''e geçmez).';
