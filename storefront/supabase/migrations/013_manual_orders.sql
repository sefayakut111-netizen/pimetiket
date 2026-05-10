-- ============================================================
-- Pim Etiket — Migration 013: Manuel Sipariş Desteği
--
-- Telefonla / WhatsApp / showroom'dan gelen siparişler için.
-- orders.user_id'yi nullable yapar + is_manual flag ekler.
-- Manuel sipariş = müşteri hesabı yok, admin elle giriyor.
-- ============================================================

-- ---------- user_id nullable ----------
alter table public.orders
  alter column user_id drop not null;

-- ---------- is_manual flag ----------
alter table public.orders
  add column if not exists is_manual boolean not null default false;

-- Index — admin filtreleme için (manuel siparişleri tara)
create index if not exists orders_is_manual_idx
  on public.orders(is_manual)
  where is_manual = true;

-- ---------- RLS guard ----------
-- Manuel siparişler (user_id null) müşteri view'lerinde GÖRÜNMEZ.
-- Mevcut RLS policy "user_id = auth.uid()" zaten null'la match etmez.
-- Service role bypass eder, admin endpoint'leri kullanır.

-- order_items için aynı durum — order_id üzerinden filtre, RLS otomatik.

-- ---------- Helper RPC: fn_create_manual_order ----------
-- Atomik sipariş oluşturma (admin endpoint için).
-- Client'tan SADECE service_role çağırabilir.

create or replace function public.fn_create_manual_order(
  p_order_id text,
  p_subtotal numeric,
  p_shipping numeric,
  p_total numeric,
  p_address jsonb,
  p_invoice jsonb,
  p_payment jsonb,
  p_estimated_delivery date,
  p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_item_id uuid;
begin
  -- Sipariş satırı (user_id null + is_manual=true)
  insert into public.orders (
    id, user_id, status, subtotal, shipping, total,
    address, invoice, payment, estimated_delivery, is_manual
  ) values (
    p_order_id, null, 'paid', p_subtotal, p_shipping, p_total,
    p_address, p_invoice, p_payment, p_estimated_delivery, true
  );

  -- Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := gen_random_uuid();
    insert into public.order_items (
      id, order_id, product, title, config,
      width, height, qty, unit, total, meta
    ) values (
      v_item_id,
      p_order_id,
      (v_item->>'product')::text,
      (v_item->>'title')::text,
      (v_item->>'config')::text,
      (v_item->>'width')::numeric,
      (v_item->>'height')::numeric,
      (v_item->>'qty')::integer,
      (v_item->>'unit')::numeric,
      (v_item->>'total')::numeric,
      coalesce(v_item->'meta', '{}'::jsonb)
    );
  end loop;

  -- İlk event
  insert into public.order_events (
    order_id, event_type, status_after, actor_role, summary, detail
  ) values (
    p_order_id,
    'order_created_manual',
    'paid',
    'admin',
    'Manuel sipariş kaydı (telefon / WhatsApp / showroom)',
    jsonb_build_object('manual', true)
  );

  return p_order_id;
end;
$$;

-- Service role çağırır
revoke execute on function public.fn_create_manual_order(text, numeric, numeric, numeric, jsonb, jsonb, jsonb, date, jsonb) from public;
revoke execute on function public.fn_create_manual_order(text, numeric, numeric, numeric, jsonb, jsonb, jsonb, date, jsonb) from authenticated;

-- ============================================================
-- Migration 013 sonu
-- ============================================================
