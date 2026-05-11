-- ============================================================
-- Pim Etiket — Migration 033: Atomic Payment Finalize RPC
--
-- Mühendis denetimi P0 (12 May):
--   /api/payment/callback PayTR onayı geldikten sonra 5 ayrı
--   INSERT/UPDATE yapıyordu (payment_intents UPDATE → orders INSERT →
--   order_items INSERT → order_events INSERT → payments INSERT).
--   Ortadan biri patlarsa müşterinin parası alındı, sipariş yarım.
--   PayTR retry mantığı duplicate sipariş oluşturuyordu.
--
-- Çözüm: fn_finalize_paid_order RPC tek atomik transaction içinde
-- tüm 5 işlemi yapar. PostgreSQL function default olarak transaction
-- içinde — hata olursa otomatik ROLLBACK.
--
-- Idempotency: payment_intents.status='consumed' ise (duplicate IPN)
-- mevcut order_id'yi döner, yeni sipariş açmaz. payment_intents UNIQUE
-- ID zaten korur.
-- ============================================================

create or replace function public.fn_finalize_paid_order(
  p_merchant_oid text,
  p_order_id text,
  p_items jsonb,
  p_payment_meta jsonb,
  p_estimated_delivery date
)
returns table(
  order_id text,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent record;
  v_existing_order_id text;
  v_item jsonb;
  v_item_qty bigint := 0;
begin
  -- 1) Intent kilitle (FOR UPDATE — duplicate IPN'i blokla)
  select id, user_id, card_amount, snapshot, status, created_at
    into v_intent
    from public.payment_intents
    where id = p_merchant_oid
    for update;

  if not found then
    raise exception 'intent_not_found' using errcode = 'P0002';
  end if;

  -- 2) Idempotency: zaten consumed ise mevcut order'ı dön
  if v_intent.status = 'consumed' then
    -- Existing order'ı bul (payment.psp_transaction_id = merchant_oid)
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

    -- consumed ama order yok — sistem hatası
    raise exception 'consumed_but_no_order:%', p_merchant_oid;
  end if;

  -- 3) Intent consume (ilk önce — duplicate guard sıkı)
  update public.payment_intents
    set status = 'consumed',
        consumed_at = now()
    where id = p_merchant_oid;

  -- 4) Orders INSERT
  insert into public.orders (
    id, user_id, status, subtotal, shipping, total,
    address, invoice, payment, estimated_delivery
  ) values (
    p_order_id,
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

  -- 5) order_items bulk INSERT (jsonb array -> rows)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product, title, config,
      width, height, qty, unit, total, meta
    ) values (
      p_order_id,
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

  -- 6) order_events 'paid' log
  insert into public.order_events (
    order_id, event_type, status_after,
    actor_id, actor_role, summary, detail
  ) values (
    p_order_id, 'paid', 'paid',
    v_intent.user_id, 'customer',
    'Ödeme alındı (PayTR).',
    p_payment_meta
  );

  -- 7) FSEK m.66 telif kabulu — Migration 030 audit_log'tan order_events'a
  -- kopya. Sipariş ID ile bağlantı kurulur.
  if (v_intent.snapshot ? 'copyright_accepted') then
    insert into public.order_events (
      order_id, event_type, status_after,
      actor_id, actor_role, summary, detail
    ) values (
      p_order_id, 'status_changed', 'paid',
      v_intent.user_id, 'customer',
      'Telif taahhüdü kabulu doğrulandı (sipariş açılırken).',
      jsonb_build_object(
        'kind', 'copyright_accepted',
        'accepted_at', v_intent.snapshot->>'copyright_accepted_at',
        'ip', v_intent.snapshot->>'copyright_accept_ip',
        'user_agent', v_intent.snapshot->>'copyright_accept_ua'
      )
    );
  end if;

  -- 8) payments başarı kaydı
  insert into public.payments (
    order_id, psp_provider, psp_transaction_id,
    action, amount, currency, status,
    idempotency_key, psp_raw, card_masked,
    installment, completed_at
  ) values (
    p_order_id, 'paytr', p_merchant_oid,
    'charge', v_intent.card_amount, 'TRY', 'success',
    'success:' || p_merchant_oid,
    p_payment_meta,
    p_payment_meta->>'masked',
    coalesce((p_payment_meta->>'installment')::integer, 1),
    now()
  );

  -- Return
  order_id := p_order_id;
  was_duplicate := false;
  return next;
end;
$$;

revoke execute on function public.fn_finalize_paid_order(
  text, text, jsonb, jsonb, date
) from public, authenticated;
grant execute on function public.fn_finalize_paid_order(
  text, text, jsonb, jsonb, date
) to service_role;

-- ============================================================
-- Migration 033 sonu
-- ============================================================
