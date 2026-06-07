-- Mig 175: PARA-FIX — M6 coupons RLS, M2 kupon rezervasyonu, M3 needs_review intent
-- Checkout validate/apply RPC korunur; broad SELECT kapanır.

-- ============================================================
-- M6: coupons — anon/authenticated doğrudan SELECT kapalı
-- ============================================================
drop policy if exists "Anyone can lookup active coupons by code" on public.coupons;

comment on table public.coupons is
  'Kupon tanımları. Müşteri doğrulama: fn_validate_coupon RPC. Uygulama: fn_apply_coupon_admin (service_role).';

-- ============================================================
-- M3: payment_intent_status — manuel inceleme kuyruğu
-- ============================================================
alter type public.payment_intent_status add value if not exists 'needs_review';

-- ============================================================
-- M2: Kupon rezervasyonu (total_uses_limit race — init anında slot tut)
-- ============================================================
create table if not exists public.coupon_reservations (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_intent_id text not null references public.payment_intents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (payment_intent_id)
);

create index if not exists coupon_reservations_coupon_idx
  on public.coupon_reservations(coupon_id);

alter table public.coupon_reservations enable row level security;
-- service_role only (route handlers)

-- Aktif pending rezervasyon sayısı (kendi intent hariç)
create or replace function public.fn_coupon_pending_reservation_count(
  p_coupon_id uuid,
  p_exclude_intent_id text default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.coupon_reservations cr
  inner join public.payment_intents pi on pi.id = cr.payment_intent_id
  where cr.coupon_id = p_coupon_id
    and pi.status = 'pending'
    and (p_exclude_intent_id is null or cr.payment_intent_id <> p_exclude_intent_id);
$$;

revoke all on function public.fn_coupon_pending_reservation_count(uuid, text) from public;
grant execute on function public.fn_coupon_pending_reservation_count(uuid, text) to service_role;

-- Init: atomik slot rezerve et
create or replace function public.fn_reserve_coupon_for_payment(
  p_code text,
  p_user_id uuid,
  p_payment_intent_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_total_used integer;
  v_user_used integer;
  v_pending integer;
begin
  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now()
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  if v_coupon.target_user_id is not null and v_coupon.target_user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'wrong_user');
  end if;

  if v_coupon.total_uses_limit is not null then
    select count(*) into v_total_used
      from public.coupon_uses where coupon_id = v_coupon.id;
    v_pending := public.fn_coupon_pending_reservation_count(v_coupon.id, null);
    if v_total_used + v_pending >= v_coupon.total_uses_limit then
      return jsonb_build_object('ok', false, 'reason', 'total_limit_reached');
    end if;
  end if;

  if v_coupon.per_user_limit is not null then
    select count(*) into v_user_used
      from public.coupon_uses
      where coupon_id = v_coupon.id and user_id = p_user_id;
    if v_user_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'reason', 'user_limit_reached');
    end if;
  end if;

  insert into public.coupon_reservations (coupon_id, user_id, payment_intent_id)
  values (v_coupon.id, p_user_id, p_payment_intent_id)
  on conflict (payment_intent_id) do nothing;

  return jsonb_build_object('ok', true, 'coupon_id', v_coupon.id);
end;
$$;

revoke all on function public.fn_reserve_coupon_for_payment(text, uuid, text) from public;
grant execute on function public.fn_reserve_coupon_for_payment(text, uuid, text) to service_role;

create or replace function public.fn_release_coupon_reservation(p_payment_intent_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.coupon_reservations
  where payment_intent_id = p_payment_intent_id;
end;
$$;

revoke all on function public.fn_release_coupon_reservation(text) from public;
grant execute on function public.fn_release_coupon_reservation(text) to service_role;

-- Intent terminal durumlarda rezervasyonu bırak (needs_review hariç — manuel inceleme)
create or replace function public.trg_payment_intent_release_coupon_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status in ('consumed', 'failed', 'expired') then
    perform public.fn_release_coupon_reservation(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists payment_intent_release_coupon_reservation on public.payment_intents;
create trigger payment_intent_release_coupon_reservation
  after update of status on public.payment_intents
  for each row
  execute function public.trg_payment_intent_release_coupon_reservation();

-- fn_validate_coupon — pending rezervasyonları limit sayımına dahil et
create or replace function public.fn_validate_coupon(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_user_id uuid := auth.uid();
  v_user_used integer;
  v_total_used integer;
  v_pending integer;
  v_discount numeric(10, 2);
begin
  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now();

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  if v_coupon.target_user_id is not null then
    if v_user_id is null or v_user_id <> v_coupon.target_user_id then
      return jsonb_build_object('ok', false, 'reason', 'wrong_user');
    end if;
  end if;

  if p_subtotal < v_coupon.min_subtotal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_subtotal',
      'min_subtotal', v_coupon.min_subtotal
    );
  end if;

  if v_coupon.total_uses_limit is not null then
    select count(*) into v_total_used
      from public.coupon_uses where coupon_id = v_coupon.id;
    v_pending := public.fn_coupon_pending_reservation_count(v_coupon.id, null);
    if v_total_used + v_pending >= v_coupon.total_uses_limit then
      return jsonb_build_object('ok', false, 'reason', 'total_limit_reached');
    end if;
  end if;

  if v_user_id is not null and v_coupon.per_user_limit is not null then
    select count(*) into v_user_used
      from public.coupon_uses
      where coupon_id = v_coupon.id and user_id = v_user_id;
    if v_user_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'reason', 'user_limit_reached');
    end if;
  end if;

  if v_coupon.kind = 'percent' then
    v_discount := round(p_subtotal * v_coupon.value / 100, 2);
    if v_coupon.max_discount is not null and v_discount > v_coupon.max_discount then
      v_discount := v_coupon.max_discount;
    end if;
  elsif v_coupon.kind = 'fixed' then
    v_discount := least(v_coupon.value, p_subtotal);
  else
    v_discount := 0;
  end if;

  return jsonb_build_object(
    'ok', true,
    'discount', v_discount,
    'kind', v_coupon.kind
  );
end;
$$;

-- fn_apply_coupon_admin — rezervasyon say + temizle
create or replace function public.fn_apply_coupon_admin(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid,
  p_order_id text,
  p_charged_discount numeric default null,
  p_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_total_used integer;
  v_user_used integer;
  v_pending integer;
  v_discount numeric(10, 2);
begin
  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now()
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  if v_coupon.target_user_id is not null and v_coupon.target_user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'wrong_user');
  end if;

  if p_subtotal < v_coupon.min_subtotal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_subtotal',
      'min_subtotal', v_coupon.min_subtotal
    );
  end if;

  if v_coupon.total_uses_limit is not null then
    select count(*) into v_total_used
      from public.coupon_uses where coupon_id = v_coupon.id;
    v_pending := public.fn_coupon_pending_reservation_count(
      v_coupon.id,
      p_payment_intent_id
    );
    if v_total_used + v_pending >= v_coupon.total_uses_limit then
      return jsonb_build_object('ok', false, 'reason', 'total_limit_reached');
    end if;
  end if;

  if v_coupon.per_user_limit is not null then
    select count(*) into v_user_used
      from public.coupon_uses
      where coupon_id = v_coupon.id and user_id = p_user_id;
    if v_user_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'reason', 'user_limit_reached');
    end if;
  end if;

  if p_charged_discount is not null then
    v_discount := case
      when v_coupon.kind = 'free_ship' then 0
      else p_charged_discount
    end;
  elsif v_coupon.kind = 'percent' then
    v_discount := round(p_subtotal * v_coupon.value / 100, 2);
    if v_coupon.max_discount is not null and v_discount > v_coupon.max_discount then
      v_discount := v_coupon.max_discount;
    end if;
  elsif v_coupon.kind = 'fixed' then
    v_discount := least(v_coupon.value, p_subtotal);
  else
    v_discount := 0;
  end if;

  insert into public.coupon_uses (coupon_id, user_id, order_id, discount_amount)
  values (v_coupon.id, p_user_id, p_order_id, v_discount);

  if p_payment_intent_id is not null then
    perform public.fn_release_coupon_reservation(p_payment_intent_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'discount', v_discount,
    'kind', v_coupon.kind,
    'coupon_id', v_coupon.id
  );
end;
$$;

revoke all on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric, text) from public;
revoke all on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric, text) from anon;
revoke all on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric, text) from authenticated;
grant execute on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric, text) to service_role;

-- Eski 5-arg overload (Mig 141) — yeni imzaya geçiş
drop function if exists public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric);

comment on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric, text) is
  'Mig 175: Ödeme callback için atomik kupon uygulama + pending rezervasyon sayımı/temizliği.';
