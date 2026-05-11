-- ============================================================
-- Pim Etiket — Migration 030: 250 TL Hediye Çeki Sistemi
--
-- Sefa kararı 11 May (3 madde):
--   1. Yeni üyeliklere ilk siparişte 250 TL indirim çeki (HOSGELDIN-XXX)
--   2. Üye davet eden, karşı taraf ilk siparişini verdiğinde 250 TL
--      hediye çeki (referans tamamlanınca)
--   3. Hediye çekleri MIN 500 TL sepet üzerinde kullanılabilir
--
-- Migration 016'daki %10 referral kuponları yerine 250 TL fixed.
-- Yeni: fn_setup_new_user_welcome — auth.users insert trigger ile
-- yeni kullanıcıya HOSGELDIN kuponu açar.
--
-- site_settings (Migration 029) üzerinden parametre alır:
--   welcome_credit_try (250)
--   referral_credit_try (250)
--   min_subtotal_for_credit (500)
-- ============================================================

-- ---------- fn_setup_new_user_welcome ----------
-- auth.users insert trigger'ı ile yeni kullanıcıya HOSGELDIN-XXX
-- 250 TL kupon oluştur. site_settings'ten miktar okur.
create or replace function public.fn_setup_new_user_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_amount numeric(10, 2);
  v_min numeric(10, 2);
begin
  -- site_settings'ten miktar oku (Migration 029)
  select welcome_credit_try, min_subtotal_for_credit
    into v_amount, v_min
    from public.site_settings where id = 1;

  -- Default fallback (settings yoksa)
  v_amount := coalesce(v_amount, 250);
  v_min := coalesce(v_min, 500);

  -- Benzersiz kod üret
  v_code := 'HOSGELDIN-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));

  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active,
    target_user_id
  ) values (
    v_code, 'fixed', v_amount, null, v_min,
    1, 1,
    now(), now() + interval '90 days',
    'Hoşgeldin hediye çeki — ilk siparişte ' || v_amount || ' TL indirim',
    true,
    new.id
  )
  on conflict (code) do nothing;

  return new;
end;
$$;

-- target_user_id alanı coupons tablosunda yoksa ekle
alter table public.coupons
  add column if not exists target_user_id uuid references auth.users(id) on delete cascade;

create index if not exists coupons_target_user_idx
  on public.coupons(target_user_id)
  where target_user_id is not null;

drop trigger if exists on_auth_user_created_welcome on auth.users;
create trigger on_auth_user_created_welcome
  after insert on auth.users
  for each row execute function public.fn_setup_new_user_welcome();

-- ---------- fn_complete_referral_v2 ----------
-- Migration 016'daki %10 percent kupon → 250 TL fixed kupon.
-- Hem referrer'a hem referred'a aynı miktar.
create or replace function public.fn_complete_referral(p_referred_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral record;
  v_amount numeric(10, 2);
  v_min numeric(10, 2);
  v_coupon_referrer text;
begin
  -- Pending referral var mı?
  select * into v_referral
  from public.referrals
  where referred_user_id = p_referred_user_id
    and status = 'pending';

  if not found then return; end if;

  -- site_settings'ten parametre
  select referral_credit_try, min_subtotal_for_credit
    into v_amount, v_min
    from public.site_settings where id = 1;
  v_amount := coalesce(v_amount, 250);
  v_min := coalesce(v_min, 500);

  -- referrer için 250 TL fixed kupon
  v_coupon_referrer := 'REF-VIP-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active,
    target_user_id
  ) values (
    v_coupon_referrer, 'fixed', v_amount, null, v_min,
    1, 1,
    now(), now() + interval '180 days',
    'Davet ettiğin arkadaş ilk siparişini verdi — ' || v_amount || ' TL hediye',
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

-- ---------- fn_apply_referral_code_v2 ----------
-- Yeni kullanıcı referans kod kullandığında 250 TL kupon ver (eski %10 yerine)
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
  v_amount numeric(10, 2);
  v_min numeric(10, 2);
begin
  -- Kod sahibi bul
  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(p_referral_code);

  if v_referrer_id is null then return false; end if;
  if v_referrer_id = p_new_user_id then return false; end if;

  -- Referred kullanıcı set
  update public.profiles
    set referred_by_user_id = v_referrer_id
    where id = p_new_user_id
      and referred_by_user_id is null;
  if not found then return false; end if;

  -- Parametre oku
  select referral_credit_try, min_subtotal_for_credit
    into v_amount, v_min
    from public.site_settings where id = 1;
  v_amount := coalesce(v_amount, 250);
  v_min := coalesce(v_min, 500);

  -- Yeni kullanıcıya 250 TL fixed kupon (HOSGELDIN dışında ekstra)
  v_coupon_referred := 'REF-NEW-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active,
    target_user_id
  ) values (
    v_coupon_referred, 'fixed', v_amount, null, v_min,
    1, 1,
    now(), now() + interval '90 days',
    'Referans bonusu — ' || v_amount || ' TL hediye',
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

-- ============================================================
-- Migration 030 sonu
-- ============================================================
