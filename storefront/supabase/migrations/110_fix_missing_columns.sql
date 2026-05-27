-- ============================================================
-- Pim Etiket — Migration 110: Eksik kolonlar + SLA fonksiyonu
--
-- Cron hataları:
--   auto-refund        → fn_process_proof_pending_sla
--   cleanup-stale-uploads → design_files.created_at
--   upload-reminders   → orders.paid_at
-- ============================================================

-- 1a. SLA kaskad fonksiyonu (Mig 070 ile uyumlu — idempotent)
create or replace function public.fn_process_proof_pending_sla()
returns table(
  order_id text,
  user_id uuid,
  action text,
  hours_since_proof numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_hours numeric;
  v_reminder_sent boolean;
begin
  for v_order in
    select id, proof_uploaded_at, user_id, status
    from public.orders
    where status = 'proof_pending'
      and proof_uploaded_at is not null
      and proof_uploaded_at < now() - interval '12 hours'
    order by proof_uploaded_at asc
  loop
    v_hours := extract(epoch from (now() - v_order.proof_uploaded_at)) / 3600;

    if v_hours >= 36 then
      update public.orders
      set status = 'cancelled'
      where id = v_order.id;

      insert into public.order_events (
        order_id, event_type, status_after, actor_role, summary, detail
      ) values (
        v_order.id,
        'auto_refund_stale_proof',
        'cancelled',
        'system',
        '36 saat onaysız iade — müşteri prova onayı vermedi',
        jsonb_build_object('auto', true, 'hours_since_proof', v_hours)
      );

      order_id := v_order.id;
      user_id := v_order.user_id;
      action := 'refund';
      hours_since_proof := v_hours;
      return next;

    else
      select exists (
        select 1
        from public.order_events
        where order_events.order_id = v_order.id
          and event_type = 'proof_reminder_12h_sent'
      ) into v_reminder_sent;

      if not v_reminder_sent then
        insert into public.order_events (
          order_id, event_type, actor_role, summary, detail
        ) values (
          v_order.id,
          'proof_reminder_12h_sent',
          'system',
          '12 saat onaysız — hatırlatma maili kuyruğa alındı',
          jsonb_build_object('hours_since_proof', v_hours)
        );

        order_id := v_order.id;
        user_id := v_order.user_id;
        action := 'reminder';
        hours_since_proof := v_hours;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.fn_process_proof_pending_sla() to authenticated;
grant execute on function public.fn_process_proof_pending_sla() to service_role;

-- 1b. design_files.created_at (cleanup-stale-uploads cron)
alter table public.design_files
  add column if not exists created_at timestamptz;

update public.design_files
set created_at = uploaded_at
where created_at is null;

alter table public.design_files
  alter column created_at set default now();

-- 1c. orders.paid_at (upload-reminders cron)
alter table public.orders
  add column if not exists paid_at timestamptz;

update public.orders
set paid_at = coalesce(updated_at, created_at)
where paid_at is null
  and status not in ('cancelled');
