-- ============================================================
-- Pim Etiket — Migration 100: Genel destek talepleri
-- ============================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  guest_email varchar(255),
  guest_name varchar(100),
  subject varchar(200) not null,
  message text not null,
  category varchar(30) not null default 'genel'
    check (category in ('genel', 'siparis', 'tasarim', 'kargo', 'iade', 'teknik', 'fiyat')),
  status varchar(20) not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  order_id text,
  admin_response text,
  admin_responded_by uuid references auth.users(id),
  admin_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id);

alter table public.support_tickets enable row level security;

drop policy if exists "Customer reads own tickets" on public.support_tickets;
create policy "Customer reads own tickets"
  on public.support_tickets for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Customer creates ticket" on public.support_tickets;
create policy "Customer creates ticket"
  on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Anon creates ticket" on public.support_tickets;
create policy "Anon creates ticket"
  on public.support_tickets for insert to anon
  with check (user_id is null and guest_email is not null);

drop policy if exists "Admin manages tickets" on public.support_tickets;
create policy "Admin manages tickets"
  on public.support_tickets for all to authenticated
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

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();
