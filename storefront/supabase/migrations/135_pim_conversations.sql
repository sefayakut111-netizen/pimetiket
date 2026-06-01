-- Mig 135: pim_conversations — üye Pim sohbet hafızası (server-side, cihaz bağımsız)
create table if not exists public.pim_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text,
  facts jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  last_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pim_conversations_user_idx
  on public.pim_conversations(user_id) where user_id is not null;

create index if not exists pim_conversations_updated_idx
  on public.pim_conversations(updated_at);

alter table public.pim_conversations enable row level security;

drop policy if exists "pim_conv_own_select" on public.pim_conversations;
create policy "pim_conv_own_select" on public.pim_conversations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "pim_conv_own_insert" on public.pim_conversations;
create policy "pim_conv_own_insert" on public.pim_conversations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "pim_conv_own_update" on public.pim_conversations;
create policy "pim_conv_own_update" on public.pim_conversations
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "pim_conv_own_delete" on public.pim_conversations;
create policy "pim_conv_own_delete" on public.pim_conversations
  for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trg_pim_conv_updated on public.pim_conversations;
create trigger trg_pim_conv_updated before update on public.pim_conversations
  for each row execute function public.set_updated_at();
