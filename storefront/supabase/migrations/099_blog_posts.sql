-- ============================================================
-- Pim Etiket — Migration 099: Blog CMS (blog_posts)
-- ============================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug varchar(120) not null unique,
  title_tr text not null,
  title_en text,
  body_tr text not null,
  body_en text,
  excerpt_tr text,
  excerpt_en text,
  category varchar(40) not null default 'genel',
  cover_image_url text,
  author_name varchar(100) default 'Pim Etiket',
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  read_minutes integer default 3,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx
  on public.blog_posts (status, published_at desc nulls last);
create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

alter table public.blog_posts enable row level security;

drop policy if exists "Anyone reads published posts" on public.blog_posts;
create policy "Anyone reads published posts"
  on public.blog_posts for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Admin manages blog posts" on public.blog_posts;
create policy "Admin manages blog posts"
  on public.blog_posts for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();
