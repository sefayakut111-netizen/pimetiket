-- Migration 141: Referral %10 kupon kuralları + kupon güvenlik sertleştirme
--
-- Mig 030'daki 250 ₺ fixed referral → Mig 016 ile uyumlu %10 percent.
-- fn_validate_coupon / fn_apply_coupon*: target_user_id + total_uses_limit kontrolü.

-- ============================================================
-- 1. fn_apply_referral_code — arkadaş kayıt anında %10
-- ============================================================

create or replace function public.fn_apply_referral_code(
  p_new_user_id uuid,
  p_referral_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_coupon_referred text;
  v_min numeric(10, 2);
begin
  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(trim(p_referral_code));

  if v_referrer_id is null then return false; end if;
  if v_referrer_id = p_new_user_id then return false; end if;

  update public.profiles
    set referred_by_user_id = v_referrer_id
    where id = p_new_user_id
      and referred_by_user_id is null;
  if not found then return false; end if;

  select min_subtotal_for_credit
    into v_min
    from public.site_settings where id = 1;
  v_min := coalesce(v_min, 100);

  v_coupon_referred := 'REF-NEW-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active,
    target_user_id
  ) values (
    v_coupon_referred, 'percent', 10, 200, v_min,
    1, 1,
    now(), now() + interval '90 days',
    'Referans bonusu — %10 indirim',
    true,
    p_new_user_id
  );

  insert into public.referrals (
    referrer_user_id, referred_user_id, status, referred_coupon_code
  ) values (
    v_referrer_id, p_new_user_id, 'pending', v_coupon_referred
  )
  on conflict (referrer_user_id, referred_user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.fn_apply_referral_code(uuid, text) to authenticated;
grant execute on function public.fn_apply_referral_code(uuid, text) to service_role;

-- ============================================================
-- 2. fn_complete_referral — davet eden, arkadaşın ilk siparişinde %10
-- ============================================================

create or replace function public.fn_complete_referral(p_referred_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral record;
  v_coupon_referrer text;
begin
  select * into v_referral
  from public.referrals
  where referred_user_id = p_referred_user_id
    and status = 'pending';

  if not found then return; end if;

  v_coupon_referrer := 'REF-VIP-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active,
    target_user_id
  ) values (
    v_coupon_referrer, 'percent', 10, 300, 100,
    1, 1,
    now(), now() + interval '180 days',
    'Davet ettiğin arkadaş ilk siparişini verdi — %10 indirim',
    true,
    v_referral.referrer_user_id
  )
  on conflict (code) do nothing;

  update public.referrals
    set status = 'completed',
        completed_at = now(),
        referrer_coupon_code = v_coupon_referrer
    where id = v_referral.id;
end;
$$;

grant execute on function public.fn_complete_referral(uuid) to authenticated;

-- ============================================================
-- 3. fn_validate_coupon — target_user_id + total_uses_limit
-- ============================================================

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
    if v_total_used >= v_coupon.total_uses_limit then
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

-- ============================================================
-- 4. fn_apply_coupon — target_user_id
-- ============================================================

create or replace function public.fn_apply_coupon(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid,
  p_order_id text
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
  v_discount numeric(10, 2);
begin
  if auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now();

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
    if v_total_used >= v_coupon.total_uses_limit then
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

  insert into public.coupon_uses (coupon_id, user_id, order_id, discount_amount)
  values (v_coupon.id, p_user_id, p_order_id, v_discount);

  return jsonb_build_object(
    'ok', true,
    'discount', v_discount,
    'kind', v_coupon.kind,
    'coupon_id', v_coupon.id
  );
end;
$$;

-- ============================================================
-- 5. fn_apply_coupon_admin — target_user_id
-- ============================================================

create or replace function public.fn_apply_coupon_admin(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid,
  p_order_id text,
  p_charged_discount numeric default null
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
    if v_total_used >= v_coupon.total_uses_limit then
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

  return jsonb_build_object(
    'ok', true,
    'discount', v_discount,
    'kind', v_coupon.kind,
    'coupon_id', v_coupon.id
  );
end;
$$;

revoke all on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric) from public;
revoke all on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric) from anon;
revoke all on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric) from authenticated;
grant execute on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric) to service_role;
