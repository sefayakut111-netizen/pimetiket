-- ============================================================
-- Pim Etiket — Migration 005
--
-- (1) coupons       → Kupon kodları (admin oluşturur, müşteri /odeme'de uygular)
-- (2) coupon_uses   → Kullanım kayıtları (limit + müşteri başına 1 kez kontrolü)
-- (3) reviews       → Müşteri yorumları (admin moderation queue'lu)
-- ============================================================

-- ---------- 1) coupons ----------
create type public.coupon_kind as enum (
  'percent',     -- %X indirim (max ile sınırlı olabilir)
  'fixed',       -- Sabit X ₺ indirim
  'free_ship'    -- Kargo ücretsiz
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Tek tip kod, case-insensitive (UPPER ile saklanır)
  code text not null unique,
  kind public.coupon_kind not null,
  -- percent → 0-100 arası (5 = %5)
  -- fixed   → ₺ miktarı (50 = 50 ₺)
  -- free_ship → 0 (yalnız bayrak)
  value numeric(10, 2) not null check (value >= 0),
  -- percent kuponu için max indirim ₺ — null = sınırsız
  max_discount numeric(10, 2),
  -- Min sepet tutarı — bu altındaysa kupon uygulanmaz
  min_subtotal numeric(10, 2) not null default 0,
  -- Toplam kullanım limiti — null = sınırsız
  total_uses_limit integer check (total_uses_limit is null or total_uses_limit > 0),
  -- Bir müşteri kaç kez kullanabilir — null = sınırsız
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  -- Geçerlilik aralığı
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  -- Admin notu (UI'da gösterilmez, dashboard için)
  description text,
  -- Aktif mi (silmek yerine deactivate)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists coupons_code_idx on public.coupons(code);
create index if not exists coupons_active_idx on public.coupons(is_active, expires_at);

alter table public.coupons enable row level security;

-- Müşteri SADECE kod doğrulama için lookup yapabilir (kod biliniyorsa
-- bu kupon var mı diye). Direkt SELECT açık tutmak yerine RPC kullandır.
-- Yine de read-only access verelim ki admin paneli kolay listelesin
-- (admin auth'undaki staff için service_role gibi davranır).
create policy "Anyone can lookup active coupons by code"
  on public.coupons for select
  using (is_active = true and (expires_at is null or expires_at > now()));

-- INSERT/UPDATE/DELETE sadece service_role (admin tarafı).

drop trigger if exists coupons_updated_at on public.coupons;
create trigger coupons_updated_at
  before update on public.coupons
  for each row
  execute function public.set_updated_at();

-- code'u UPPER ile sakla — case-insensitive lookup
create or replace function public.fn_coupons_normalize_code()
returns trigger
language plpgsql
as $$
begin
  new.code = upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists coupons_normalize on public.coupons;
create trigger coupons_normalize
  before insert or update on public.coupons
  for each row
  execute function public.fn_coupons_normalize_code();

-- ---------- 2) coupon_uses ----------
create table if not exists public.coupon_uses (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null references public.orders(id) on delete cascade,
  -- O sipariş için bu kuponla ne kadar düşürüldü
  discount_amount numeric(10, 2) not null check (discount_amount >= 0),
  used_at timestamptz not null default now(),
  -- Bir sipariş başına 1 kupon kuralı
  unique (order_id)
);

create index if not exists coupon_uses_coupon_idx on public.coupon_uses(coupon_id);
create index if not exists coupon_uses_user_idx on public.coupon_uses(user_id);

alter table public.coupon_uses enable row level security;

create policy "Users can view own coupon uses"
  on public.coupon_uses for select
  using (auth.uid() = user_id);

-- INSERT sadece service_role (atomik kontrol fn_apply_coupon ile yapılır)

-- Helper: kuponu uygula. Atomik kontrol + insert.
create or replace function public.fn_apply_coupon(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid,
  p_order_id text
)
returns jsonb       -- { ok: bool, discount: number, reason?: string }
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
  -- Sadece kendi siparişin için
  if auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  -- Kuponu bul
  select * into v_coupon
    from public.coupons
    where code = upper(trim(p_code))
      and is_active = true
      and (expires_at is null or expires_at > now())
      and starts_at <= now();

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;

  -- Min subtotal kontrolü
  if p_subtotal < v_coupon.min_subtotal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_subtotal',
      'min_subtotal', v_coupon.min_subtotal
    );
  end if;

  -- Toplam kullanım limiti
  if v_coupon.total_uses_limit is not null then
    select count(*) into v_total_used
      from public.coupon_uses where coupon_id = v_coupon.id;
    if v_total_used >= v_coupon.total_uses_limit then
      return jsonb_build_object('ok', false, 'reason', 'total_limit_reached');
    end if;
  end if;

  -- Per-user kullanım limiti
  if v_coupon.per_user_limit is not null then
    select count(*) into v_user_used
      from public.coupon_uses
      where coupon_id = v_coupon.id and user_id = p_user_id;
    if v_user_used >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'reason', 'user_limit_reached');
    end if;
  end if;

  -- İndirim hesabı
  if v_coupon.kind = 'percent' then
    v_discount := round(p_subtotal * v_coupon.value / 100, 2);
    if v_coupon.max_discount is not null and v_discount > v_coupon.max_discount then
      v_discount := v_coupon.max_discount;
    end if;
  elsif v_coupon.kind = 'fixed' then
    v_discount := least(v_coupon.value, p_subtotal);
  else  -- free_ship → indirim 0, kargo ayrı düşülür
    v_discount := 0;
  end if;

  -- Kullanım kaydı
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

grant execute on function public.fn_apply_coupon to authenticated;

comment on function public.fn_apply_coupon is
  'Sipariş oluşturma esnasında kupon uygulama. Atomik kontrol + insert. JSON döner.';

-- Helper: sadece kontrol et (uygulama YAPMA) — UI'da "geçerli mi?" preview
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

  if p_subtotal < v_coupon.min_subtotal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'min_subtotal',
      'min_subtotal', v_coupon.min_subtotal
    );
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

grant execute on function public.fn_validate_coupon to anon, authenticated;

-- ---------- 3) reviews ----------
create type public.review_status as enum (
  'pending',     -- Moderation bekliyor
  'published',   -- Yayında
  'rejected',    -- Reddedildi
  'hidden'       -- Yayından kaldırıldı (admin)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Hangi siparişle ilgili (1 sipariş = 1 yorum kuralı)
  order_id text not null references public.orders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null check (length(body) >= 10 and length(body) <= 2000),
  -- Tüketici öne çıkanlar / şikayetler
  pros text,
  cons text,
  status public.review_status not null default 'pending',
  -- Admin moderation notu
  moderation_note text,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  -- Helpful counter (gelecekte upvote)
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Bir sipariş için tek yorum
  unique (user_id, order_id)
);

create index if not exists reviews_status_idx
  on public.reviews(status, created_at desc);
create index if not exists reviews_rating_idx on public.reviews(rating);

alter table public.reviews enable row level security;

-- Yayında olan yorumları herkes görebilir (galeri/anasayfa)
create policy "Anyone can view published reviews"
  on public.reviews for select
  using (status = 'published');

-- Müşteri kendi yorumunu (her status'ta) görür
create policy "Users can view own reviews"
  on public.reviews for select
  using (auth.uid() = user_id);

-- Müşteri yorum yazabilir (sadece kendi delivered siparişine)
create policy "Users can create review on delivered order"
  on public.reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.user_id = auth.uid()
        and o.status = 'delivered'
    )
  );

-- Müşteri kendi pending yorumunu silebilir (henüz yayına çıkmadan)
create policy "Users can delete own pending review"
  on public.reviews for delete
  using (auth.uid() = user_id and status = 'pending');

-- UPDATE sadece service_role (moderation)

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();
