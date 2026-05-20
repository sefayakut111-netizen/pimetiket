-- ============================================================
-- Pim Etiket — Migration 043: fn_setup_new_user_welcome fix
--
-- Sefa 16 May Google OAuth test:
-- "Database error saving new user" hatası
--
-- Sebep: fn_setup_new_user_welcome içinde gen_random_bytes(4)
-- çağrılıyor — bu pgcrypto extension'a ait. SECURITY DEFINER ile
-- search_path = 'public' set edilmiş, ama pgcrypto 'extensions'
-- schema'da. Fonksiyon bulunamıyor → trigger fail → auth.users
-- INSERT rollback → "Database error saving new user".
--
-- Fix: gen_random_uuid() kullan (postgres core, pgcrypto gerekmez).
-- Aynı sonuç: 6 karakterlik random hex string.
-- ============================================================

create or replace function public.fn_setup_new_user_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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

  -- Benzersiz kod üret — gen_random_uuid postgres core'da
  -- (gen_random_bytes pgcrypto'da, search_path sorunu oluyor)
  v_code := 'HOSGELDIN-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active,
    target_user_id
  ) values (
    v_code, 'fixed', v_amount, null, v_min,
    1, 1,
    now(), now() + interval '90 days',
    'Hoşgeldin hediye çeki — ilk siparişte ' || v_amount || ' ₺ indirim',
    true,
    new.id
  )
  on conflict (code) do nothing;

  return new;
end;
$function$;

comment on function public.fn_setup_new_user_welcome() is
  'Yeni kullanıcı için welcome credit kupon oluşturur. Migration 043 — gen_random_bytes (pgcrypto) yerine gen_random_uuid (core) ile fix.';
