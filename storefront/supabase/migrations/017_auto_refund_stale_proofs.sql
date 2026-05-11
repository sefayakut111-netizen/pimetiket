-- ============================================================
-- Pim Etiket — Migration 017: 36 Saat Onaysız İade
--
-- Sefa kararı: müşteri prova göndermesinden 36 saat sonra hâlâ onay
-- vermediyse otomatik iptal + iade (TKHK m.15 cayma uyumu).
--
-- Tetikleyici: Vercel daily cron → /api/cron/auto-refund → bu RPC
-- ============================================================

create or replace function public.fn_auto_refund_stale_proofs()
returns table(order_id text, hours_since_proof numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  for v_order in
    select id, proof_uploaded_at, user_id
    from public.orders
    where status = 'proof_pending'
      and proof_uploaded_at is not null
      and proof_uploaded_at < now() - interval '36 hours'
  loop
    -- Status cancelled
    update public.orders
    set status = 'cancelled'
    where id = v_order.id;

    -- Event log
    insert into public.order_events (
      order_id, event_type, status_after, actor_role, summary, detail
    ) values (
      v_order.id,
      'auto_refund_stale_proof',
      'cancelled',
      'system',
      '36 saat onaysız iade — müşteri prova onayı vermedi',
      jsonb_build_object(
        'auto', true,
        'hours_since_proof', extract(epoch from (now() - v_order.proof_uploaded_at)) / 3600
      )
    );

    order_id := v_order.id;
    hours_since_proof := extract(epoch from (now() - v_order.proof_uploaded_at)) / 3600;
    return next;
  end loop;
end;
$$;

-- Service role + authenticated execution (admin endpoint çağırır)
grant execute on function public.fn_auto_refund_stale_proofs() to authenticated;
grant execute on function public.fn_auto_refund_stale_proofs() to service_role;
