-- Migration 143: handle_new_user OAuth dayanıklılığı + Google isim fallback
--
-- B2: fn_generate_referral_code / fn_apply_referral_code hata verse bile auth.users INSERT geri alınmasın.
-- B3: display_name için full_name / name fallback (Google OAuth metadata).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_code text;
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'customer'
  )
  on conflict (id) do nothing;

  begin
    perform public.fn_generate_referral_code(new.id);
  exception
    when others then null;
  end;

  v_referral_code := new.raw_user_meta_data->>'referral_code';
  if v_referral_code is not null and v_referral_code <> '' then
    begin
      perform public.fn_apply_referral_code(new.id, v_referral_code);
    exception
      when others then null;
    end;
  end if;

  return new;
end;
$$;
