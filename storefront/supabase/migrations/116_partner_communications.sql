-- Partner iletişim geçmişi (admin fason detay)

create table if not exists public.partner_communications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.fason_partners(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'phone', 'other')),
  summary text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_communications_partner
  on public.partner_communications (partner_id, created_at desc);

comment on table public.partner_communications is
  'Fason partner ile operatör iletişim kayıtları (WhatsApp, e-posta, arama)';

alter table public.partner_communications enable row level security;

drop policy if exists "Admin manages partner communications" on public.partner_communications;
create policy "Admin manages partner communications"
  on public.partner_communications for all to authenticated
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

grant select, insert, update, delete on public.partner_communications to authenticated;
grant all on public.partner_communications to service_role;
