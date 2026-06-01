-- Mig 131: fn_process_proof_pending_sla — updated_at yerine proof_uploaded_at
-- Admin dokunuşu iade saatini sıfırlamaz.

drop function if exists public.fn_process_proof_pending_sla();

create or replace function public.fn_process_proof_pending_sla()
returns table(
  order_id text,
  user_id uuid,
  hours_since_proof numeric,
  action text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    o.id::text,
    o.user_id,
    extract(epoch from (now() - o.proof_uploaded_at)) / 3600.0,
    'refund'::text
  from public.orders o
  where o.status = 'proof_pending'
    and o.proof_uploaded_at is not null
    and o.proof_uploaded_at < now() - interval '36 hours'
  union all
  select
    o.id::text,
    o.user_id,
    extract(epoch from (now() - o.proof_uploaded_at)) / 3600.0,
    'reminder'::text
  from public.orders o
  where o.status = 'proof_pending'
    and o.proof_uploaded_at is not null
    and o.proof_uploaded_at < now() - interval '12 hours'
    and o.proof_uploaded_at >= now() - interval '36 hours'
    and not exists (
      select 1
      from public.order_events e
      where e.order_id = o.id
        and e.event_type = 'proof_reminder_sent'
        and e.created_at > now() - interval '24 hours'
    );
end;
$$;

revoke all on function public.fn_process_proof_pending_sla() from public;
revoke all on function public.fn_process_proof_pending_sla() from anon;
revoke all on function public.fn_process_proof_pending_sla() from authenticated;
grant execute on function public.fn_process_proof_pending_sla() to service_role;

comment on function public.fn_process_proof_pending_sla() is
  'Mig 131: SLA kaskadi — proof_uploaded_at bazli (admin updated_at dokunusu sayaci sifirlamaz).';
