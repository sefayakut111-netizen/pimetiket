-- Mig 172: proof_uploaded_at — otomatik proof_pending geçişinde SLA başlangıcı
-- E2E P0#1: cutline/QC/orchestrator proof_pending'e geçerken proof_uploaded_at NULL
-- kalıyordu → fn_process_proof_pending_sla hiç seçmiyordu.

-- 1) cutline INSERT trigger — proof_pending + proof_uploaded_at birlikte
create or replace function public.fn_advance_after_cutline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status public.order_status;
begin
  if TG_OP = 'INSERT' then
    select status into v_current_status from public.orders where id = NEW.order_id;
    if v_current_status = 'proof_generating' then
      update public.orders
        set status = 'proof_pending',
            proof_uploaded_at = coalesce(proof_uploaded_at, now()),
            updated_at = now()
        where id = NEW.order_id and status = 'proof_generating';
    end if;
  end if;
  return NEW;
end;
$$;

comment on function public.fn_advance_after_cutline is
  'cutline_designs INSERT → proof_generating → proof_pending + proof_uploaded_at (SLA başlangıcı).';

-- 2) Genel guard — status proof_pending olunca proof_uploaded_at boşsa doldur
create or replace function public.fn_set_proof_uploaded_at_on_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'proof_pending'
     and (OLD.status is distinct from 'proof_pending')
     and NEW.proof_uploaded_at is null then
    NEW.proof_uploaded_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_proof_uploaded_at_on_pending on public.orders;
create trigger trg_set_proof_uploaded_at_on_pending
  before update on public.orders
  for each row
  execute function public.fn_set_proof_uploaded_at_on_pending();

comment on function public.fn_set_proof_uploaded_at_on_pending is
  'Mig 172: proof_pending geçişinde proof_uploaded_at set — 36h SLA kaskadı tetiklenir. Revizyon (zaten dolu) sayacı sıfırlamaz.';
