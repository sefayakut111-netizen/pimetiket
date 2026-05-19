-- ============================================================
-- Migration 064 — fn_auto_advance_to_proof_pending early-return fix
-- ============================================================
-- Sefa 19 May v68 (canli sipariş gözleminden):
-- fn_finalize_paid_order RPC sirasi:
--   Step 4: orders INSERT (status='paid') → trigger CALISIR
--   Step 5: order_items INSERT (sonra)
--
-- Önceki trigger (Mig 061) Step 4'te early return yapiyordu:
--   if not exists (select 1 from order_items where order_id = NEW.id)
--     then return NEW;
--
-- Sonuç: Step 4'te order_items YOK → trigger erken return → status='paid'
-- kaliyordu. Step 5'te items eklendi ama trigger zaten geçti.
--
-- Fix: early-return guard kaldirildi. fn_order_has_design zaten false
-- döner → awaiting_upload set edilir (doğru sonuç).
-- ============================================================

create or replace function public.fn_auto_advance_to_proof_pending()
returns trigger
language plpgsql
security definer
as $$
declare
  v_has_design boolean;
begin
  -- Sadece status paid'e yeni geçtiyse tetikle (idempotent)
  if (TG_OP = 'UPDATE' and OLD.status <> 'paid' and NEW.status = 'paid')
     or (TG_OP = 'INSERT' and NEW.status = 'paid') then

    -- Mig 064: early-return guard kaldirildi. RPC orders INSERT sonra
    -- order_items INSERT yapiyor → order_items o anda yok → fn_order_has_design
    -- false → awaiting_upload set edilir. Doğru davraniş.
    v_has_design := public.fn_order_has_design(NEW.id);

    if v_has_design then
      NEW.status := 'proof_pending';
    else
      NEW.status := 'awaiting_upload';
    end if;
  end if;
  return NEW;
end;
$$;

-- Trigger zaten orders üzerinde kurulu (Mig 059). Re-create gerekmez.

comment on function public.fn_auto_advance_to_proof_pending is
  'paid INSERT/UPDATE durumunda awaiting_upload (design yoksa) veya proof_pending (design varsa) state geciser. Mig 064: order_items check guard kaldirildi.';
