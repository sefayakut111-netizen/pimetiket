-- ============================================================
-- Migration 065 — Sequential order ID (çakışma önleme)
-- ============================================================
-- Sefa kuralı (19 May v68): Sipariş ID 0001'den sıralı, çakışma olmasın.
-- Önceki client-side random (DDMMYYYY+rand4) doğum günü paradoksu ile
-- yıllık ~%2.7 çakışma riski + müşteri ödeyip sipariş kayboluyor.
--
-- Çözüm: PostgreSQL SEQUENCE — atomic, concurrent-safe, asla çakışmaz.
-- Format: LPAD(nextval, 8, '0') = '00000001', '00000002', ...
-- 9999. siparişten sonra doğal büyür (5+ hane), front-end LPAD bozulmaz.
--
-- Eski siparişler (PE-2026-XXX) dokunulmaz — geriye uyumlu.
-- ============================================================

-- 1) SEQUENCE
create sequence if not exists public.order_id_seq
  start with 1
  increment by 1
  no maxvalue
  cache 1;

comment on sequence public.order_id_seq is
  'Sipariş ID sıra numarası. fn_finalize_paid_order tarafından nextval edilir. Atomic, çakışma imkansız.';

-- 2) fn_finalize_paid_order — p_order_id ignore, nextval ile üret
create or replace function public.fn_finalize_paid_order(
  p_merchant_oid text,
  p_order_id text,                   -- ignore edilir (geriye uyumluluk için param tutuldu)
  p_items jsonb,
  p_payment_meta jsonb,
  p_estimated_delivery date
) returns table(order_id text, was_duplicate boolean)
language plpgsql
security definer
as $$
declare
  v_intent record;
  v_existing_order_id text;
  v_item jsonb;
  v_item_qty bigint := 0;
  v_new_order_id text;
begin
  -- 1) Intent kilitle (FOR UPDATE - duplicate IPN blocku)
  select id, user_id, card_amount, snapshot, status, created_at
    into v_intent
    from public.payment_intents
    where id = p_merchant_oid
    for update;

  if not found then
    raise exception 'intent_not_found' using errcode = 'P0002';
  end if;

  -- 2) Idempotency: consumed ise mevcut order'i don
  if v_intent.status = 'consumed' then
    select po.order_id into v_existing_order_id
      from public.payments po
      where po.psp_transaction_id = p_merchant_oid
        and po.action = 'charge'
        and po.status = 'success'
      limit 1;

    if v_existing_order_id is not null then
      order_id := v_existing_order_id;
      was_duplicate := true;
      return next;
      return;
    end if;

    raise exception 'consumed_but_no_order:%', p_merchant_oid;
  end if;

  -- 3) Intent consume
  update public.payment_intents
    set status = 'consumed', consumed_at = now()
    where id = p_merchant_oid;

  -- 4) Mig 065: sequence ile yeni siparis ID uret (8 hane padded)
  v_new_order_id := lpad(nextval('public.order_id_seq')::text, 8, '0');

  -- 5) Orders INSERT
  insert into public.orders (
    id, user_id, status, subtotal, shipping, total,
    address, invoice, payment, estimated_delivery
  ) values (
    v_new_order_id,
    v_intent.user_id,
    'paid',
    (v_intent.snapshot->>'subtotal')::numeric,
    (v_intent.snapshot->>'shipping')::numeric,
    (v_intent.snapshot->>'total')::numeric,
    v_intent.snapshot->'address',
    v_intent.snapshot->'invoice',
    p_payment_meta,
    p_estimated_delivery
  );

  -- 6) order_items bulk INSERT
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product, title, config,
      width, height, qty, unit, total, meta
    ) values (
      v_new_order_id,
      v_item->>'product',
      v_item->>'title',
      v_item->>'config',
      (v_item->>'width')::integer,
      (v_item->>'height')::integer,
      (v_item->>'qty')::integer,
      (v_item->>'unit')::numeric,
      (v_item->>'total')::numeric,
      coalesce(v_item->'meta', '{}'::jsonb)
    );
    v_item_qty := v_item_qty + 1;
  end loop;

  -- 7) order_events 'paid' log
  insert into public.order_events (
    order_id, event_type, status_after,
    actor_id, actor_role, summary, detail
  ) values (
    v_new_order_id, 'paid', 'paid',
    v_intent.user_id, 'customer',
    'Odeme alindi (PayTR).',
    p_payment_meta
  );

  -- 8) FSEK m.66 telif kabulu - Migration 030 audit_log'tan order_events
  if (v_intent.snapshot ? 'copyright_accepted') then
    insert into public.order_events (
      order_id, event_type, status_after,
      actor_id, actor_role, summary, detail
    ) values (
      v_new_order_id, 'status_changed', 'paid',
      v_intent.user_id, 'customer',
      'Telif taahhudu kabulu dogrulandi (siparis acilirken).',
      jsonb_build_object(
        'kind', 'copyright_accepted',
        'accepted_at', v_intent.snapshot->>'copyright_accepted_at',
        'ip', v_intent.snapshot->>'copyright_accept_ip',
        'user_agent', v_intent.snapshot->>'copyright_accept_ua'
      )
    );
  end if;

  -- 9) payments basari kaydi
  insert into public.payments (
    order_id, psp_provider, psp_transaction_id,
    action, amount, currency, status,
    idempotency_key, psp_raw, card_masked,
    installment, completed_at
  ) values (
    v_new_order_id, 'paytr', p_merchant_oid,
    'charge', v_intent.card_amount, 'TRY', 'success',
    'success:' || p_merchant_oid,
    p_payment_meta,
    p_payment_meta->>'masked',
    coalesce((p_payment_meta->>'installment')::integer, 1),
    now()
  );

  -- Return
  order_id := v_new_order_id;
  was_duplicate := false;
  return next;
end;
$$;

comment on function public.fn_finalize_paid_order is
  'Mig 065: p_order_id artik ignore edilir (geriye uyumluluk icin tutuldu). order_id_seq.nextval ile atomic, cakismasiz 8-hane padded ID uretilir.';
