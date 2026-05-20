-- ============================================================
-- Pim Etiket — Migration 007
--
-- payment_intents: ödeme öncesi geçici state.
-- /odeme submit'te oluşur, iyzico callback'inde kullanılır,
-- sipariş açıldıktan sonra status='consumed' olarak işaretlenir.
--
-- AKIŞ:
--   1. /api/payment/init → INSERT (status=pending, snapshot=cart+address+invoice)
--   2. iyzico CheckoutForm → user 3DS yapar
--   3. iyzico callback → /api/payment/callback POST
--   4. Server: SELECT intent by conversationId → fn_create_order →
--      UPDATE intent (status=consumed, order_id)
--      INSERT payments (status=success)
--
-- Eski intent'ler (>24 saat) cron ile temizlenebilir (status=pending,
-- created_at < now() - 24h).
-- ============================================================

create type public.payment_intent_status as enum (
  'pending',     -- /odeme/init oluşturdu, henüz ödenmedi
  'consumed',    -- callback'te kullanıldı, sipariş açıldı
  'failed',      -- iyzico fail döndü
  'expired'      -- 24h'tan eski, cron temizledi
);

create table if not exists public.payment_intents (
  -- conversationId — iyzico'ya gönderdiğimiz unique id
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- iyzico token (CheckoutForm Initialize'den dönen)
  iyzico_token text,
  -- Tutar (₺, KDV dahil) — iyzico'da bu kadar tahsil edilecek
  card_amount numeric(10, 2) not null check (card_amount >= 0),
  wallet_amount numeric(10, 2) not null default 0 check (wallet_amount >= 0),
  total_amount numeric(10, 2) generated always as (card_amount + wallet_amount) stored,
  -- Sipariş bilgileri snapshot (cart + address + invoice + shipping)
  -- callback'te fn_create_order çağrısında bu kullanılır
  snapshot jsonb not null,
  status public.payment_intent_status not null default 'pending',
  -- Sipariş açıldıktan sonra bağlanır
  order_id text references public.orders(id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists payment_intents_user_idx
  on public.payment_intents(user_id, created_at desc);
create index if not exists payment_intents_status_idx
  on public.payment_intents(status, created_at desc);
create index if not exists payment_intents_token_idx
  on public.payment_intents(iyzico_token)
  where iyzico_token is not null;

alter table public.payment_intents enable row level security;

-- Müşteri sadece kendi intent'lerini görür
create policy "Users can view own payment intents"
  on public.payment_intents for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE sadece service_role (route handler).
-- Müşteri direkt intent oluşturamaz — /api/payment/init endpoint'inden
-- geçer (validation + auth + iyzico call).

-- Helper: intent consume — fn_create_order'ı atomik çağırır
create or replace function public.fn_consume_payment_intent(
  p_intent_id text,
  p_order_id text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
begin
  select * into v_intent
    from public.payment_intents
    where id = p_intent_id
      and user_id = p_user_id
      and status = 'pending'
    for update;

  if not found then
    raise exception 'intent_not_found_or_already_consumed';
  end if;

  update public.payment_intents
    set status = 'consumed',
        order_id = p_order_id,
        consumed_at = now()
    where id = p_intent_id;

  return true;
end;
$$;

-- service_role + authenticated execute (callback handler service_role
-- kullanır; admin de çağırabilsin)
grant execute on function public.fn_consume_payment_intent
  to service_role;

comment on table public.payment_intents is
  'Ödeme intent staging — /api/payment/init INSERT, callback CONSUME, fn_create_order çağrısında snapshot kullanılır.';

comment on function public.fn_consume_payment_intent is
  'Intent consume + sipariş ID bağla. SELECT FOR UPDATE ile race-safe.';
