-- Mig 186: eski cat='all' yolunun yazdığı NULL blocked_categories'i ['lead']'e backfill.
-- reason filtresi admin manuel block-all (NULL=kasıtlı) satırlarını HARİÇ tutar.
UPDATE public.mail_suppressions
  SET blocked_categories = ARRAY['lead']::text[]
  WHERE suppression_type IN ('unsubscribe_marketing','unsubscribe_blog')
    AND blocked_categories IS NULL
    AND reason LIKE 'user_unsubscribe%';
-- Idempotent (re-run 0 satır). fn_is_suppressed'e DOKUNULMAZ. bounce_hard/complaint/unsubscribe_all/manual_admin DOKUNULMAZ.
