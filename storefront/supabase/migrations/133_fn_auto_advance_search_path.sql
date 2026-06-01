-- Mig 133: fn_auto_advance_to_proof_pending — search_path injection fix

create or replace function public.fn_auto_advance_to_proof_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_design boolean;
begin
  if (TG_OP = 'UPDATE' and OLD.status <> 'paid' and NEW.status = 'paid')
     or (TG_OP = 'INSERT' and NEW.status = 'paid') then

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

comment on function public.fn_auto_advance_to_proof_pending is
  'paid INSERT/UPDATE → awaiting_upload veya proof_pending. Mig 133: set search_path=public.';
