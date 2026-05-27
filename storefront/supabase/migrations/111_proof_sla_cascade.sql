-- ============================================================
-- Pim Etiket — Migration 111: Proof pending SLA kaskadi (read-only RPC)
--
-- 12sa+ proof_pending → action: reminder
-- 36sa+ proof_pending → action: refund
-- Yan etkiler (iptal, mail, event) /api/cron/auto-refund tarafinda.
-- ============================================================

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
  -- 36+ saat: iptal + iade adayi
  select
    o.id::text,
    o.user_id,
    extract(epoch from (now() - o.updated_at)) / 3600.0,
    'refund'::text
  from public.orders o
  where o.status = 'proof_pending'
    and o.updated_at < now() - interval '36 hours'
  union all
  -- 12-36 saat: hatirlatma (24sa icinde reminder gonderilmediyse)
  select
    o.id::text,
    o.user_id,
    extract(epoch from (now() - o.updated_at)) / 3600.0,
    'reminder'::text
  from public.orders o
  where o.status = 'proof_pending'
    and o.updated_at < now() - interval '12 hours'
    and o.updated_at >= now() - interval '36 hours'
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
  'SLA kaskadi — 12sa reminder + 36sa refund adaylarini listeler. Cron route yan etkileri uygular.';
