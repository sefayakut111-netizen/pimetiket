-- Migration 051: Cloudflare R2 Cold Storage altyapısı
--
-- Sefa 18 May v68 (R2 cold storage paketi):
-- 3 ay (90 gün) hareketsiz müşterilerin Supabase'den R2'ye taşınması için
-- archive_status enum + her tabloya 3 ek kolon + audit log tablosu.
--
-- Pre-req: Sefa Cloudflare R2 hesabı + env vars set etti (R2_ACCOUNT_ID, vb.)
-- Post-req: `npx supabase db push --linked`
--
-- NOT: Bu migration `pim_conversations` ve `pim_memory` tablolarını
-- DÂHIL ETMİYOR (sistemde mevcut değiller, Pim sohbet şu an anonim).
-- İleride pim_conversations tablosu eklenirse ayrı migration ile arşiv
-- kolonları eklenir.

-- =========================================================
-- 1. ENUM TANIMI
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'archive_status') then
    create type public.archive_status as enum (
      'hot',           -- Supabase'de aktif
      'archiving',     -- Taşınma sırasında (race condition koruması)
      'cold',          -- R2'de, sıcakta sadece referans
      'restoring',     -- R2'den geri çekiliyor
      'deleted'        -- KVKK silme tamamlandı, sadece audit kalır
    );
  end if;
end$$;

-- =========================================================
-- 2. TABLOLARA ARŞİV KOLONLARI
-- =========================================================

-- Müşteri profilleri
alter table public.profiles
  add column if not exists archive_status public.archive_status not null default 'hot',
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archive_path text;

-- Siparişler
alter table public.orders
  add column if not exists archive_status public.archive_status not null default 'hot',
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archive_path text;

-- Tasarım dosyaları (en kritik, en çok yer kaplayan)
alter table public.design_files
  add column if not exists archive_status public.archive_status not null default 'hot',
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archive_path text,
  add column if not exists archive_size_bytes bigint;

-- Yorumlar
alter table public.reviews
  add column if not exists archive_status public.archive_status not null default 'hot',
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archive_path text;

-- İadeler
alter table public.returns
  add column if not exists archive_status public.archive_status not null default 'hot',
  add column if not exists archived_at timestamp with time zone,
  add column if not exists archive_path text;

-- =========================================================
-- 3. INDEXLER (cron sorgularını hızlandırmak için)
-- =========================================================
create index if not exists idx_profiles_archive_status
  on public.profiles(archive_status, archived_at);

create index if not exists idx_orders_archive_status
  on public.orders(archive_status, created_at);

create index if not exists idx_design_files_archive_status
  on public.design_files(archive_status, created_at);

-- =========================================================
-- 4. ARŞİV AUDIT TABLOSU (KVKK uyumu için kritik)
-- =========================================================
create table if not exists public.archive_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'archived_to_cold',
    'restored_to_hot',
    'permanent_deleted',
    'kvkk_delete_request',
    'cold_access',          -- arşivden okuma (signed URL üretimi)
    'failed_archive',
    'failed_restore'
  )),
  resource_type text not null,  -- 'order', 'design_file', 'profile', 'customer_bundle' vs.
  resource_id uuid not null,
  user_id uuid,                 -- veriye ait kullanıcı
  actor_id uuid,                -- işlemi tetikleyen (cron için null)
  actor_type text default 'system' check (actor_type in ('system', 'user', 'admin', 'cowork')),
  archive_path text,
  size_bytes bigint,
  reason text,                  -- "3 ay hareketsizlik", "Sefa manuel", vs.
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_archive_events_resource
  on public.archive_events(resource_type, resource_id);
create index if not exists idx_archive_events_user
  on public.archive_events(user_id, created_at desc);
create index if not exists idx_archive_events_type
  on public.archive_events(event_type, created_at desc);

-- =========================================================
-- 5. RLS POLICY'LER
-- =========================================================
alter table public.archive_events enable row level security;

-- Sadece admin arşiv event'lerini görebilir
drop policy if exists "admin_read_archive_events" on public.archive_events;
create policy "admin_read_archive_events"
  on public.archive_events for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'staff')
    )
  );

-- Service role bypass eder, kullanıcı yazamaz
drop policy if exists "block_user_insert_archive_events" on public.archive_events;
create policy "block_user_insert_archive_events"
  on public.archive_events for insert
  with check (false);

-- =========================================================
-- 6. YARDIMCI FONKSİYON: Arşiv adayı sorgusu
-- =========================================================
create or replace function public.get_archive_candidates(p_days_inactive int default 90)
returns table (
  user_id uuid,
  last_activity_at timestamp with time zone,
  order_count int,
  has_active_orders boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    coalesce(max(o.created_at), p.created_at) as last_activity_at,
    count(o.id)::int as order_count,
    coalesce(
      bool_or(o.status in ('paid', 'in_production', 'shipped', 'pending')),
      false
    ) as has_active_orders
  from public.profiles p
  left join public.orders o on o.user_id = p.id
  where p.archive_status = 'hot'
  group by p.id, p.created_at
  having coalesce(max(o.created_at), p.created_at) < (now() - (p_days_inactive || ' days')::interval)
    and not coalesce(
      bool_or(o.status in ('paid', 'in_production', 'shipped', 'pending')),
      false
    )
$$;

-- =========================================================
-- 7. COMMENT NOTLARI
-- =========================================================
comment on type public.archive_status is
  'Veri yaşam döngüsü durumu. hot=Supabase aktif, archiving=taşınıyor, cold=R2, restoring=geri çekiliyor, deleted=KVKK silindi (audit kalır)';

comment on table public.archive_events is
  'Tüm arşiv işlemleri (taşıma, geri çekme, silme, erişim) audit log. KVKK m.11/h erişim hakkı için zorunlu.';

comment on function public.get_archive_candidates is
  'Arşivlenmeye uygun müşterileri döner: hot durumda + son aktivite N gün öncesinden eski + aktif siparişi yok (paid/in_production/shipped/pending dışında).';
