-- Mig 163: ai_usage_logs — Pim chat/summarize OpenAI maliyet izleme

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('pim_chat', 'pim_summarize')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  tokens_used integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  user_id uuid references auth.users (id) on delete set null,
  persona text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_idx
  on public.ai_usage_logs (created_at desc);

create index if not exists ai_usage_logs_source_created_idx
  on public.ai_usage_logs (source, created_at desc);

alter table public.ai_usage_logs enable row level security;

-- Sadece service_role yazar/okur (admin auditor)
revoke all on public.ai_usage_logs from public, authenticated;
grant select, insert on public.ai_usage_logs to service_role;
