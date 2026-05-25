create table if not exists public.proof_validations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  order_item_id uuid,
  design_file_id uuid,

  rule_check_passed boolean,
  rule_issues jsonb,

  ai_validated boolean default false,
  ai_verdict text check (ai_verdict in ('pass', 'warn', 'fail')),
  ai_cutline jsonb,
  ai_white_layer jsonb,
  ai_suggestions jsonb,
  ai_pim_message text,
  ai_tokens_used integer,
  ai_cost_usd numeric(8,6),

  auto_fixed boolean default false,
  fix_log jsonb,

  final_verdict text check (final_verdict in ('pass', 'warn', 'fail', 'operator')),
  created_at timestamptz default now()
);

create index if not exists proof_validations_order_idx on public.proof_validations(order_id);

alter table public.proof_validations enable row level security;

drop policy if exists "Admin reads proof validations" on public.proof_validations;
create policy "Admin reads proof validations"
  on public.proof_validations for select to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')
  ));

drop policy if exists "Customer reads own proof validations" on public.proof_validations;
create policy "Customer reads own proof validations"
  on public.proof_validations for select to authenticated
  using (exists (
    select 1 from public.orders where id = order_id and user_id = auth.uid()
  ));
