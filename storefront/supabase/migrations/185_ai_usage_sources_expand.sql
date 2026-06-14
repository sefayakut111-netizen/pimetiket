-- Mig 185: ai_usage_logs source CHECK genişlet (FAZ 3.2). design_qc EKLENMEZ
-- (maliyeti design_quality_checks'te sayılıyor — çift-sayım önleme). Desen: mig 167.
alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_source_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_source_check
  check (source in (
    'pim_chat','pim_summarize','support_classify','search_intent','image_upscale',
    'proof_validate','cutline_feedback','cutline_vision','editor_command',
    'humanize_qc','humanize_note','daily_summary'
  ));
