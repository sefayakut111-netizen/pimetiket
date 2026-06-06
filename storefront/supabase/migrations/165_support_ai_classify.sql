-- Mig 165: Destek talebi AI sınıflandırma öneri kolonları + priority

alter table public.support_tickets
  add column if not exists priority text
    check (priority in ('low', 'normal', 'high', 'urgent'))
    default 'normal';

alter table public.support_tickets
  add column if not exists ai_category_suggestion text;

alter table public.support_tickets
  add column if not exists ai_priority_suggestion text;

alter table public.support_tickets
  add column if not exists ai_draft_response text;

alter table public.support_tickets
  add column if not exists ai_classified_at timestamptz;

-- ai_usage_logs: support_classify kaynağı
alter table public.ai_usage_logs
  drop constraint if exists ai_usage_logs_source_check;

alter table public.ai_usage_logs
  add constraint ai_usage_logs_source_check
  check (source in ('pim_chat', 'pim_summarize', 'support_classify'));
