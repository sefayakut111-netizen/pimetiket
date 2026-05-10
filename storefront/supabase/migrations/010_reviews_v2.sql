-- ============================================================
-- Pim Etiket — Migration 010: Reviews v2 (yorum toplama sistemi)
--
-- Mevcut reviews tablosunu genişletir + review_requests tablosu ekler.
-- Akış: order delivered → review_request oluştur → 24h sonra mail/banner
--       → kullanıcı yorum yazar → admin moderation → public.
--
-- Yayın yerleri: ürün sayfası (kategori bazlı) + anasayfa (latest 9, 4-5 yıldız).
-- ============================================================

-- ---------- reviews tablosu — genişletme ----------

-- show_on_homepage: kullanıcı yorum yaparken anasayfada paylaşmama opsiyonu
alter table public.reviews
  add column if not exists show_on_homepage boolean not null default true;

-- featured: admin elle "öne çıkar" seçer
alter table public.reviews
  add column if not exists featured boolean not null default false;

-- display_name: "Sefa Yakut" mu "Sefa Y." mı (kullanıcı tercihi)
alter table public.reviews
  add column if not exists display_name varchar(120);

-- photos: jsonb array of Storage paths (max 2 - app layer'da kontrol)
alter table public.reviews
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- product_type: 'etiket' | 'sticker' (anasayfada kategori filtreleme için)
-- Order'ın items'ından türetilebilir ama denormalize ediyoruz, daha hızlı
alter table public.reviews
  add column if not exists product_type varchar(20);

-- Yardımcı index — anasayfa query (approved + show_on_homepage + rating>=4)
create index if not exists reviews_homepage_idx
  on public.reviews(status, show_on_homepage, rating, created_at desc)
  where status = 'published' and show_on_homepage = true and rating >= 4;

-- Ürün sayfası query
create index if not exists reviews_product_idx
  on public.reviews(product_type, status, created_at desc)
  where status = 'published';

-- ---------- review_requests tablosu ----------
--
-- Her teslim alınmış sipariş için 1 row. Yorum talep akışı (mail + banner).
-- 30 gün sonra expire olur, daha fazla bildirim atılmaz.

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Tetik anı: kargo teslim edildi
  delivered_at timestamptz not null,

  -- Mail durumu
  email_sent_at timestamptz,
  email_opened_at timestamptz,
  email_clicked_at timestamptz,

  -- In-app banner durumu (kullanıcı her login'de banner görüyor)
  in_app_shown_count integer not null default 0,
  last_in_app_shown_at timestamptz,
  in_app_dismissed_until timestamptz, -- "Daha sonra" → 3 gün sonra tekrar
  in_app_dismissed_permanently boolean not null default false,

  -- Yorum yazıldı mı? Yazıldıysa hangi review
  review_id uuid references public.reviews(id) on delete set null,
  completed_at timestamptz,

  -- Talep durumu
  status varchar(20) not null default 'pending',
  -- pending | completed | expired | dismissed
  expires_at timestamptz not null,

  -- Token (mail linkinde kullanılır, login olmadan yorum yazabilir)
  request_token uuid not null default gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 1 sipariş = 1 review_request
  unique (order_id)
);

create index if not exists review_requests_user_idx
  on public.review_requests(user_id, status);
create index if not exists review_requests_status_idx
  on public.review_requests(status, expires_at);
create index if not exists review_requests_token_idx
  on public.review_requests(request_token);
create index if not exists review_requests_pending_email_idx
  on public.review_requests(delivered_at, email_sent_at)
  where status = 'pending' and email_sent_at is null;

alter table public.review_requests enable row level security;

-- Kullanıcı sadece kendi review_request'ını görür
drop policy if exists "Users see own review requests" on public.review_requests;
create policy "Users see own review requests"
  on public.review_requests for select
  to authenticated
  using (user_id = auth.uid());

-- Kullanıcı kendi review_request'ını update edebilir (banner dismiss etc.)
drop policy if exists "Users update own review requests" on public.review_requests;
create policy "Users update own review requests"
  on public.review_requests for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service role insert/delete yapar (trigger + cron)
-- (RLS bypass; insert/delete için ayrı policy gerekmiyor service_role'ler için)

-- ---------- Trigger: orders.status → 'delivered' → review_request yarat ----------

create or replace function public.on_order_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sadece status 'delivered' OLDUYsa ve daha önce delivered DEĞİLDİ
  if NEW.status = 'delivered' and (OLD.status is null or OLD.status <> 'delivered') then
    -- review_request zaten varsa skip (1 sipariş = 1 talep)
    insert into public.review_requests (
      order_id,
      user_id,
      delivered_at,
      expires_at,
      status
    )
    values (
      NEW.id,
      NEW.user_id,
      now(),
      now() + interval '30 days',
      'pending'
    )
    on conflict (order_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_order_delivered_review_request on public.orders;
create trigger trg_order_delivered_review_request
  after update of status on public.orders
  for each row
  execute function public.on_order_delivered();

-- ---------- Helper function: get_homepage_reviews ----------
--
-- Anasayfada gösterilecek son N yorum.
-- Filtre: approved + show_on_homepage + rating >= 4.

create or replace function public.get_homepage_reviews(p_limit integer default 9)
returns table (
  id uuid,
  rating integer,
  body text,
  display_name varchar,
  product_type varchar,
  photos jsonb,
  featured boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.rating,
    r.body,
    coalesce(r.display_name, 'Müşteri') as display_name,
    r.product_type,
    r.photos,
    r.featured,
    r.created_at
  from public.reviews r
  where r.status = 'published'
    and r.show_on_homepage = true
    and r.rating >= 4
  order by r.featured desc, r.created_at desc
  limit p_limit;
$$;

-- ---------- Helper function: get_product_reviews ----------

create or replace function public.get_product_reviews(
  p_product_type text,
  p_limit integer default 20
)
returns table (
  id uuid,
  rating integer,
  body text,
  display_name varchar,
  photos jsonb,
  featured boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.rating,
    r.body,
    coalesce(r.display_name, 'Müşteri') as display_name,
    r.photos,
    r.featured,
    r.created_at
  from public.reviews r
  where r.status = 'published'
    and r.product_type = p_product_type
  order by r.featured desc, r.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_homepage_reviews(integer) to anon, authenticated;
grant execute on function public.get_product_reviews(text, integer) to anon, authenticated;

-- ---------- review-photos storage bucket ----------
-- Kullanıcı yüklediği yorum fotoları için yeni bucket
-- (designs / return-photos / public-assets'a ek olarak)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  true,                    -- public read (yorum fotoğrafları herkese açık)
  5242880,                 -- 5 MB / dosya
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: review-photos bucket
-- INSERT: müşteri sadece kendi review_request'i delivered olmuş siparişine yükleyebilir
drop policy if exists "Users upload review photos" on storage.objects;
create policy "Users upload review photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] in (
      select rr.order_id from public.review_requests rr
      where rr.user_id = auth.uid() and rr.status = 'pending'
    )
  );

-- SELECT: herkes (public bucket — anasayfa + ürün sayfası)
drop policy if exists "Anyone reads review photos" on storage.objects;
create policy "Anyone reads review photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'review-photos');

-- DELETE: yorum sahibi sadece pending durumdaki yorumun fotoğrafını silebilir
drop policy if exists "Users delete own pending review photos" on storage.objects;
create policy "Users delete own pending review photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'review-photos'
    and exists (
      select 1 from public.reviews r
      where (storage.foldername(name))[1] = r.order_id
        and r.user_id = auth.uid()
        and r.status = 'pending'
    )
  );

-- ============================================================
-- Migration 010 sonu
-- ============================================================
