-- Migration 117 — partner_capabilities approval_status (inline onay akışı)
-- product_group/material_key kullanılmıyor — mevcut capability_type/value korunur.

ALTER TABLE public.partner_capabilities
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_capabilities_approval_status_check'
  ) THEN
    ALTER TABLE public.partner_capabilities
      ADD CONSTRAINT partner_capabilities_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

UPDATE public.partner_capabilities
SET approval_status = CASE
  WHEN is_verified = true THEN 'approved'
  ELSE 'pending'
END
WHERE approval_status IS DISTINCT FROM CASE
  WHEN is_verified = true THEN 'approved'
  ELSE 'pending'
END;

CREATE OR REPLACE FUNCTION public.fn_find_best_partner(
  p_product_type text,
  p_material text,
  p_order_amount numeric DEFAULT 0
)
RETURNS TABLE (
  partner_id uuid,
  partner_name text,
  default_lead_days int,
  cached_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.default_lead_days,
    p.cached_score
  FROM public.fason_partners p
  WHERE p.status = 'active'
    AND (
      p.contract_signed_at IS NOT NULL
      OR (p.contract_pdf_url IS NOT NULL AND length(trim(p.contract_pdf_url)) > 0)
    )
    AND EXISTS (
      SELECT 1 FROM public.partner_capabilities pc
      WHERE pc.partner_id = p.id
        AND pc.capability_type = 'product_type'
        AND pc.capability_value = p_product_type
        AND pc.approval_status = 'approved'
        AND pc.is_verified = true
    )
    AND (
      p_material IS NULL
      OR EXISTS (
        SELECT 1 FROM public.partner_capabilities pc
        WHERE pc.partner_id = p.id
          AND pc.capability_type = 'material'
          AND pc.capability_value = p_material
          AND pc.approval_status = 'approved'
          AND pc.is_verified = true
      )
    )
    AND (p.min_order_amount_try IS NULL OR p.min_order_amount_try <= p_order_amount)
  ORDER BY
    coalesce(p.cached_score, 0.5) DESC,
    p.default_lead_days ASC;
END;
$$;

COMMENT ON COLUMN public.partner_capabilities.approval_status IS
  'Mig 117: pending | approved | rejected — inline admin onay akışı';
