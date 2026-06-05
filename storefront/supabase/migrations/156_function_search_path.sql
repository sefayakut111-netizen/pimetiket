-- Mig 156: Tüm public schema fonksiyonlarına search_path = public sabitle
-- (Supabase security advisor: Function Search Path Mutable — 143 uyarı)
-- DİKKAT: search_path = public (BOŞ değil) → mevcut davranış korunur, sadece sabitlenir.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'  -- sadece normal fonksiyonlar (trigger/aggregate dahil 'f')
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public',
        fn.name, fn.args
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.%(%): %', fn.schema, fn.name, fn.args, SQLERRM;
    END;
  END LOOP;
END $$;
