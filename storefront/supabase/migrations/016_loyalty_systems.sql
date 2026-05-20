-- ============================================================
-- Pim Etiket — Migration 016: Sadakat Sistemleri
--
-- Cüzdan yerine 4 alternatif kazanç sistemi (Sefa kararı 10 May):
--   1. VIP statüsü — 3+ tamamlanmış sipariş veren müşteri
--   2. Referans kodu — arkadaşına davet, ikiniz de %10
--   3. Tekrar baskı indirimi — geçmiş sipariş üzerinden %10
--   4. Yorum bonusu — yayınlanan yoruma 100 ₺ kupon
--
-- Tümü mevcut `coupons` altyapısını kullanır (gri alan riski yok,
-- E-Para lisansı gerek değil).
-- ============================================================

-- ---------- 1. VIP STATÜSÜ ----------
-- profiles.vip_since: ilk 3+ sipariş tamamlandığında set olur

alter table public.profiles
  add column if not exists vip_since timestamp with time zone;

create index if not exists profiles_vip_idx
  on public.profiles(vip_since)
  where vip_since is not null;

-- VIP trigger — yeni sipariş veya status değişiminde check
create or replace function public.fn_check_vip_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count int;
begin
  v_user_id := new.user_id;
  if v_user_id is null then return new; end if;

  -- İptal edilenler hariç tüm sipariş sayısı
  select count(*) into v_count
  from public.orders
  where user_id = v_user_id
    and status <> 'cancelled';

  if v_count >= 3 then
    update public.profiles
      set vip_since = coalesce(vip_since, now())
      where id = v_user_id and vip_since is null;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_vip_check on public.orders;
create trigger orders_vip_check
  after insert or update of status on public.orders
  for each row
  execute function public.fn_check_vip_status();

-- ---------- 2. REFERANS KODU ----------
-- profiles.referral_code: benzersiz 12-char kod (PIM-XXXXXXXX)
-- profiles.referred_by_user_id: bu kullanıcı kim tarafından getirildi

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists profiles_referral_code_idx
  on public.profiles(referral_code)
  where referral_code is not null;

-- Referral aktivite tablosu — kim kimi getirdi, ne zaman tamamlandı
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending', -- pending / completed / expired
  /** Davet edenin %10 indirim kuponu */
  referrer_coupon_code text,
  /** Davet edilenin %10 indirim kuponu */
  referred_coupon_code text,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  unique(referrer_user_id, referred_user_id)
);

alter table public.referrals enable row level security;

drop policy if exists "Users see own referrals" on public.referrals;
create policy "Users see own referrals"
  on public.referrals for select
  to authenticated
  using (
    auth.uid() = referrer_user_id or auth.uid() = referred_user_id
  );

-- Helper: benzersiz referral code üret
create or replace function public.fn_generate_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
  v_existing text;
begin
  -- Önce mevcut kod var mı kontrol
  select referral_code into v_existing
  from public.profiles where id = p_user_id;
  if v_existing is not null then return v_existing; end if;

  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Could not generate unique referral code';
    end if;

    -- PIM-XXXXXXXX format (8 chars upper alphanumeric)
    v_code := 'PIM-' || upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));

    -- Benzersizlik kontrolü
    perform 1 from public.profiles where referral_code = v_code;
    if not found then
      update public.profiles set referral_code = v_code where id = p_user_id;
      return v_code;
    end if;
  end loop;
end;
$$;

grant execute on function public.fn_generate_referral_code(uuid) to authenticated;

-- Helper: bir referral kodunu kullan (kayıt sırasında veya checkout'ta)
-- Yeni kullanıcı kayıt olduğunda ilk kez kullanılır
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
begin
  -- Kod sahibi bul
  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(p_referral_code);

  if v_referrer_id is null then return false; end if;
  if v_referrer_id = p_new_user_id then return false; end if; -- kendi kodunu kullanamaz

  -- Yeni kullanıcının referred_by_user_id alanını set et
  update public.profiles
    set referred_by_user_id = v_referrer_id
    where id = p_new_user_id
      and referred_by_user_id is null;
  if not found then return false; end if; -- zaten referans var

  -- Yeni kullanıcıya %10 indirim kuponu oluştur (90 gün geçerli)
  v_coupon_referred := 'REF-NEW-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active
  ) values (
    v_coupon_referred, 'percent', 10, 200, 100,
    1, 1,
    now(), now() + interval '90 days',
    'Referans kodu — ilk sipariş %10 indirim', true
  );

  -- referrals kaydı (referrer için kupon hemen oluşmaz, referred ilk siparişini verince oluşur)
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

-- Helper: referans tamamlandığında çağrılır (referred kullanıcı ilk siparişini verince)
-- referrer'a %10 kupon oluştur
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
  -- Pending referral var mı?
  select * into v_referral
  from public.referrals
  where referred_user_id = p_referred_user_id
    and status = 'pending';

  if not found then return; end if;

  -- referrer için %10 kupon oluştur
  v_coupon_referrer := 'REF-VIP-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  insert into public.coupons (
    code, kind, value, max_discount, min_subtotal,
    total_uses_limit, per_user_limit,
    starts_at, expires_at, description, is_active
  ) values (
    v_coupon_referrer, 'percent', 10, 300, 100,
    1, 1,
    now(), now() + interval '180 days',
    'Referans tamamlandı — sonraki siparişte %10', true
  );

  update public.referrals
    set status = 'completed',
        completed_at = now(),
        referrer_coupon_code = v_coupon_referrer
    where id = v_referral.id;
end;
$$;

grant execute on function public.fn_complete_referral(uuid) to authenticated;

-- ---------- 3. TEKRAR BASKI İNDİRİMİ ----------
-- order_items.reprint_source_order_id: hangi geçmiş sipariş tekrar bastırıldı

alter table public.order_items
  add column if not exists reprint_source_order_id text references public.orders(id) on delete set null;

create index if not exists order_items_reprint_source_idx
  on public.order_items(reprint_source_order_id)
  where reprint_source_order_id is not null;

-- ---------- 4. YORUM BONUSU ----------
-- reviews.bonus_coupon_code: yorum yayınlandığında oluşan 100 ₺ kupon

alter table public.reviews
  add column if not exists bonus_coupon_code text;

-- Trigger: yorum status 'published' olunca 100 ₺ kupon oluştur
create or replace function public.fn_apply_review_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- Sadece pending → published geçişinde + henüz bonus verilmediyse
  if new.status = 'published'
     and (old.status is null or old.status <> 'published')
     and new.bonus_coupon_code is null
     and new.user_id is not null
  then
    -- Benzersiz kupon kodu
    v_code := 'YORUM-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));

    -- Coupons tablosuna ekle (100 ₺ fixed, 90 gün, kullanıcıya özel limit yok ama tek kullanımlık)
    insert into public.coupons (
      code, kind, value, max_discount, min_subtotal,
      total_uses_limit, per_user_limit,
      starts_at, expires_at, description, is_active
    ) values (
      v_code, 'fixed', 100, 100, 200,
      1, 1,
      now(), now() + interval '90 days',
      'Yorum bonus — bir sonraki siparişte 100 ₺', true
    );

    -- Review'a kupon kodu ekle
    new.bonus_coupon_code := v_code;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_apply_bonus on public.reviews;
create trigger reviews_apply_bonus
  before update on public.reviews
  for each row
  execute function public.fn_apply_review_bonus();

-- ---------- 5. Otomatik referral code üret (yeni kullanıcı için) ----------
-- handle_new_user trigger'ını genişlet — yeni profilde referral code üret

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referral_code text;
begin
  -- Profile oluştur (eğer yoksa)
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'customer'
  )
  on conflict (id) do nothing;

  -- Referans kodu otomatik üret
  perform public.fn_generate_referral_code(new.id);

  -- Eğer kayıt sırasında referral_code metadata'da varsa uygula
  v_referral_code := new.raw_user_meta_data->>'referral_code';
  if v_referral_code is not null and v_referral_code <> '' then
    perform public.fn_apply_referral_code(new.id, v_referral_code);
  end if;

  return new;
end;
$$;

-- ============================================================
-- Migration 016 sonu
-- ============================================================
