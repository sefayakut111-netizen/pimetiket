-- Faz 5: Fason dosya transfer logu + CRM aktivite logu

create table if not exists public.fason_file_transfers (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  partner_id uuid not null references public.fason_partners(id) on delete cascade,
  file_type text not null check (file_type in ('image', 'cutline', 'both')),
  file_url text not null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_fason_file_transfers_partner
  on public.fason_file_transfers (partner_id, sent_at desc);

create index if not exists idx_fason_file_transfers_order
  on public.fason_file_transfers (order_id, sent_at desc);

comment on table public.fason_file_transfers is
  'Fason partnere gönderilen baskı dosyası transfer kayıtları (signed URL snapshot)';

create table if not exists public.customer_activity_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('phone', 'whatsapp', 'email', 'note')),
  summary text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_activity_log_customer
  on public.customer_activity_log (customer_id, created_at desc);

comment on table public.customer_activity_log is
  'Operatör manuel müşteri iletişim kayıtları (telefon, WhatsApp, e-posta, not)';

alter table public.fason_file_transfers enable row level security;
alter table public.customer_activity_log enable row level security;

drop policy if exists "Admin manages fason file transfers" on public.fason_file_transfers;
create policy "Admin manages fason file transfers"
  on public.fason_file_transfers for all to authenticated
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

drop policy if exists "Admin manages customer activity log" on public.customer_activity_log;
create policy "Admin manages customer activity log"
  on public.customer_activity_log for all to authenticated
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

grant select, insert, update, delete on public.fason_file_transfers to authenticated;
grant all on public.fason_file_transfers to service_role;

grant select, insert, update, delete on public.customer_activity_log to authenticated;
grant all on public.customer_activity_log to service_role;
