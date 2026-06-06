-- Mig 167: ai_usage_logs — image_upscale kaynağı

alter table public.ai_usage_logs
  drop constraint if exists ai_usage_logs_source_check;

alter table public.ai_usage_logs
  add constraint ai_usage_logs_source_check
  check (source in ('pim_chat', 'pim_summarize', 'support_classify', 'search_intent', 'image_upscale'));
