-- Migration 181: anon/authenticated RPC EXECUTE sertleştirme
-- FAZ 1 (5 yeni fn) + FAZ 2.6 (6 mevcut anon-açık RPC) — doğrudan-PostgREST deliklerini kapat.
-- Adversaryal doğrulandı (anon-rpc-revoke-safety workflow, 13 ajan): tüm bu RPC'ler
-- uygulamada YALNIZ service_role ile çağrılıyor → revoke meşru akışı kırmaz, yalnız
-- /rest/v1/rpc/<fn> anon erişim yüzeyini kapatır. 'anon' ADIYLA revoke edilir
-- (eski mig'ler sadece public/authenticated demiş, canlıda anon grant'ı hayatta kalmış).

DO $$
DECLARE
  r record;
  svc text[] := ARRAY[                      -- service_role EXECUTE kalır (uygulama çağırıyor)
    'fn_transition_order_status','fn_with_advisory_lock','fn_release_advisory_lock',
    'fn_validate_fason_token','fn_complete_referral','fn_apply_referral_code',
    'fn_refresh_fason_scores','fn_suggest_fason_partner','fn_enqueue_mail'
  ];
  internal text[] := ARRAY[                  -- yalnız iç SECURITY DEFINER çağrı — kimseye grant yok
    'fn_is_valid_order_forward_transition','fn_is_valid_order_bulk_transition'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (svc || internal)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    IF r.proname = ANY (svc) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;
