-- OG-1: Onay görseli sistemi (prova akışından ayrı kanal)
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  order_item_id uuid null references public.order_items(id) on delete set null,
  source text not null check (source in ('admin', 'partner')),
  partner_id uuid null references public.fason_partners(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  message text null,
  blocking boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  customer_comment text null,
  decided_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists approval_requests_order_status_idx
  on public.approval_requests (order_id, status);

create table if not exists public.approval_assets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests(id) on delete cascade,
  storage_path text not null,
  mime text not null,
  sort int not null default 0
);

create index if not exists approval_assets_request_id_idx
  on public.approval_assets (request_id);

alter table public.approval_requests enable row level security;
alter table public.approval_assets enable row level security;

-- Müşteri: yalnızca kendi siparişinin isteklerini SELECT
drop policy if exists approval_requests_customer_select on public.approval_requests;
create policy approval_requests_customer_select
  on public.approval_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = approval_requests.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists approval_assets_customer_select on public.approval_assets;
create policy approval_assets_customer_select
  on public.approval_assets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.approval_requests ar
      join public.orders o on o.id = ar.order_id
      where ar.id = approval_assets.request_id
        and o.user_id = auth.uid()
    )
  );

comment on table public.approval_requests is
  'Onay görseli istekleri — prova akışından bağımsız müşteri onay kanalı.';
comment on table public.approval_assets is
  'Onay görseli dosyaları — designs bucket approvals/{orderId}/{requestId}/';
