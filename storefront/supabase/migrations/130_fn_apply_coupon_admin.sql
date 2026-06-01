-- Mig 130: fn_apply_coupon_admin — service-role atomik kupon uygulama (TOCTOU fix)
-- Callback/recovery yolu auth.uid() olmadan çalışır; coupon satırı FOR UPDATE ile kilitlenir.

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

comment on function public.fn_apply_coupon_admin(text, numeric, uuid, text, numeric) is
  'Mig 130: Ödeme callback/recovery için atomik kupon uygulama. FOR UPDATE + insert aynı transaction.';
