-- ============================================================
-- Migration 078 — Sipariş ID format: DDMMYYYY + rand4 (Sefa kuralı)
-- ============================================================
-- Sefa kuralı (19 May v68, yeniden teyit 22 May v68):
--   Sipariş ID = DDMMYYYY + 4 rakam = 12 hane saf rakam.
--   Örn: 220520264837 → 22 Mayıs 2026, random 4837.
--   Operatör görür görmez tarihi okur.
--
-- Migration 065 (19 May v68): "p_order_id ignore edilir, RPC sequence ile
--   8-hane padded sıralı ID üretir" → BU YANLIŞTI. Sefa'nın gerçek kuralı
--   tarih damgalı format; Mig 065 çakışma korkusuyla onu bypass etti.
--
-- Bu migration: fn_finalize_paid_order'ı revize eder, client'in verdiği
--   p_order_id'yi kullanır. Client tarafı zaten DDMMYYYY+rand4 üretiyor
--   (customer-order.ts generateOrderId).
--
-- Çakışma stratejisi (günlük 10K kombinasyon → günde 270 sipariş için
--   %2.7 çakışma):
--   - DB unique constraint zaten var (orders.id PRIMARY KEY).
--   - Çakışırsa SQL exception (duplicate_object/unique_violation).
--   - payment-callback handler exception'ı yakalar, generateOrderId()
--     ile yeni ID üretip retry yapar (en fazla 3 deneme).
--   - Gerçek üretim hacmi günde 1-10 sipariş → pratik çakışma olasılığı
--     ~0%.
--
-- Eski formatlardaki siparişler (00000001, PE-2026-XXX) korunur, sadece
-- yeni siparişler bu format'ta açılır.
-- ============================================================

create or replace function public.fn_finalize_paid_order(
  p_merchant_oid text,
  p_order_id text,
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
begin
  -- 1) Intent kilitle (FOR UPDATE — duplicate IPN blocku)
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

  -- 3) p_order_id validate — boş olmamalı (Mig 078: client'in ürettiği
  --    DDMMYYYY+rand4 12-hane sayı; ama format'ı zorlamayız ki manuel/
  --    legacy ID'ler de geçebilsin).
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'order_id_required' using errcode = '22023';
  end if;

  -- 4) Intent consume
  update public.payment_intents
    set status = 'consumed', consumed_at = now()
    where id = p_merchant_oid;

  -- 5) Orders INSERT — client'in verdiği p_order_id'yi kullan
  --    (Mig 065'in sequence-bypass'ı kaldırıldı — Sefa kuralına dönüldü)
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

  -- 6) order_items bulk INSERT
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

  -- 7) order_events 'paid' log
  insert into public.order_events (
    order_id, event_type, status_after,
    actor_id, actor_role, summary, detail
  ) values (
    p_order_id, 'paid', 'paid',
    v_intent.user_id, 'customer',
    'Odeme alindi (PayTR).',
    p_payment_meta
  );

  -- 8) FSEK m.66 telif kabulu — Migration 030 audit_log'tan order_events
  if (v_intent.snapshot ? 'copyright_accepted') then
    insert into public.order_events (
      order_id, event_type, status_after,
      actor_id, actor_role, summary, detail
    ) values (
      p_order_id, 'status_changed', 'paid',
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

comment on function public.fn_finalize_paid_order is
  'Mig 078 (Sefa kurali geri): p_order_id artik kullanilir. Client DDMMYYYY+rand4 ureti, RPC bunu kullanir. Cakisma -> unique_violation -> client retry.';

-- ============================================================
-- order_id_seq sequence Mig 065'te kuruldu — bırakıyoruz (drop etmek
-- riskli, başka yerlerden referans olabilir; sadece artık kullanılmıyor).
-- ============================================================

-- ============================================================
-- ROLLBACK NOTU
-- ============================================================
-- Bu migration'ı rollback için Mig 065'in `fn_finalize_paid_order` halini
-- tekrar create or replace ile yükleyin.
