-- ============================================================
-- Migration 182: KVKK DB-PII silme — fn_delete_user_pii (Mimari A)
-- auth.users'a DOKUNMAZ (GoTrue route'ta anonimleşir). Hard_delete + anonymize
-- matrisini TEK transaction'da uygular, idempotent, audit'li.
-- ŞEMA TEYİDİ: types.ts + migration DDL. NOT NULL placeholder'lar:
--   returns.customer_name/customer_email/description(>=20)/attachments,
--   loyalty_grants.reason, design_files.original_name,
--   orders.address/invoice (jsonb), payment_intents.snapshot (jsonb).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_delete_user_pii(
  p_user_id uuid,
  p_user_email text,
  p_kvkk_request_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_actor_role text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     public.profiles%ROWTYPE;
  v_order_ids   text[];
  v_hard_counts jsonb := '{}'::jsonb;
  v_anon_counts jsonb := '{}'::jsonb;
  v_n           bigint;
BEGIN
  -- 0) Kullanıcı + idempotency guard
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'skipped', 'profile_not_found', 'user_id', p_user_id);
  END IF;
  IF v_profile.display_name = 'Silinmiş Kullanıcı'
     AND v_profile.tc IS NULL
     AND v_profile.archive_status = 'deleted' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'user_id', p_user_id, 'kvkk_request_id', p_kvkk_request_id);
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO v_order_ids
    FROM public.orders WHERE user_id = p_user_id;

  -- ========== 1) HARD_DELETE (saklama yok) ==========
  DELETE FROM public.addresses WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('addresses', v_n);

  DELETE FROM public.customer_invoice_profiles WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('customer_invoice_profiles', v_n);

  DELETE FROM public.cart_items WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('cart_items', v_n);

  DELETE FROM public.design_temp_uploads WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('design_temp_uploads', v_n);

  DELETE FROM public.editor_cutline_drafts WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('editor_cutline_drafts', v_n);

  DELETE FROM public.proof_help_requests WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('proof_help_requests', v_n);

  DELETE FROM public.review_requests WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('review_requests', v_n);

  DELETE FROM public.customer_notes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('customer_notes', v_n);

  DELETE FROM public.customer_tags WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('customer_tags', v_n);

  -- DİKKAT: anahtar customer_id (user_id DEĞİL)
  DELETE FROM public.customer_activity_log WHERE customer_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('customer_activity_log', v_n);

  DELETE FROM public.notification_prefs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('notification_prefs', v_n);

  DELETE FROM public.referrals
    WHERE referrer_user_id = p_user_id OR referred_user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('referrals', v_n);

  DELETE FROM public.pim_conversations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('pim_conversations', v_n);

  -- EMAIL-anahtarlı (p_user_email NULL ise güvenle atla)
  IF p_user_email IS NOT NULL AND length(trim(p_user_email)) > 0 THEN
    DELETE FROM public.support_tickets WHERE user_id = p_user_id OR guest_email = p_user_email;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('support_tickets', v_n);

    DELETE FROM public.email_subscribers WHERE email = p_user_email;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('email_subscribers', v_n);

    DELETE FROM public.fason_mail_outbox
      WHERE to_email = p_user_email
         OR (target_type = 'order' AND target_id = ANY (v_order_ids));
    GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('fason_mail_outbox', v_n);

    DELETE FROM public.auth_failed_logins WHERE email = p_user_email;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('auth_failed_logins', v_n);
  ELSE
    DELETE FROM public.support_tickets WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('support_tickets', v_n);

    DELETE FROM public.fason_mail_outbox
      WHERE target_type = 'order' AND target_id = ANY (v_order_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_hard_counts := v_hard_counts || jsonb_build_object('fason_mail_outbox', v_n);
  END IF;

  -- ========== 2) ANONYMIZE (satır kalır, user_id'ye DOKUNMA) ==========
  -- orders: address (name overwrite, phone/addr/label sil, city/district KALIR); invoice (tc sil, vkn/companyName/taxOffice KALIR)
  UPDATE public.orders
    SET address = ((address - 'phone' - 'addr' - 'label') || jsonb_build_object('name', 'Silinmiş Kullanıcı')),
        invoice = (invoice - 'tc'),
        updated_at = now()
    WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_anon_counts := v_anon_counts || jsonb_build_object('orders', v_n);

  UPDATE public.payment_intents
    SET snapshot = (snapshot - 'address' - 'invoice'), iyzico_token = NULL
    WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_anon_counts := v_anon_counts || jsonb_build_object('payment_intents', v_n);

  -- returns: NOT NULL kolonlar → placeholder (description >= 20 char ZORUNLU)
  UPDATE public.returns
    SET customer_name  = 'Silinmiş Kullanıcı',
        customer_email = CASE WHEN customer_email IS NOT NULL THEN 'deleted@local' ELSE customer_email END,
        description    = CASE WHEN description IS NOT NULL THEN '[KVKK kapsaminda silindi - kisisel veri kaldirildi]' ELSE description END,
        attachments    = ARRAY[]::text[],
        updated_at     = now()
    WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_anon_counts := v_anon_counts || jsonb_build_object('returns', v_n);

  UPDATE public.design_files
    SET original_name = 'deleted', operator_note = NULL, updated_at = now()
    WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_anon_counts := v_anon_counts || jsonb_build_object('design_files', v_n);

  UPDATE public.loyalty_grants SET reason = '[silindi]' WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_anon_counts := v_anon_counts || jsonb_build_object('loyalty_grants', v_n);

  -- ========== 3) profiles — EN SON (idempotency tombstone) ==========
  UPDATE public.profiles
    SET display_name = 'Silinmiş Kullanıcı', phone = NULL, company_name = NULL,
        tax_office = NULL, tc = NULL, vkn = NULL, email_verified_at = NULL,
        archive_status = 'deleted', updated_at = now()
    WHERE id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_anon_counts := v_anon_counts || jsonb_build_object('profiles', v_n);

  -- ========== 4) audit_log — TEK kayıt; detail'e KİŞİ-PII YAZMA ==========
  INSERT INTO public.audit_log (actor_id, actor_email, actor_role, action, target_type, target_id, summary, detail)
  VALUES (
    p_actor_id, NULL,
    (CASE WHEN p_actor_role IN ('admin','staff','customer','system') THEN p_actor_role ELSE 'admin' END),
    'profile.delete'::public.audit_action, 'kvkk_request', COALESCE(p_kvkk_request_id::text, p_user_id::text),
    'KVKK DB-PII silindi/anonimleştirildi',
    jsonb_build_object('kvkk_request_id', p_kvkk_request_id, 'hard_delete', v_hard_counts,
                       'anonymize', v_anon_counts,
                       'has_email_key', (p_user_email IS NOT NULL AND length(trim(p_user_email)) > 0))
  );

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'user_id', p_user_id,
                            'kvkk_request_id', p_kvkk_request_id,
                            'hard_delete', v_hard_counts, 'anonymize', v_anon_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_delete_user_pii(uuid, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_delete_user_pii(uuid, text, uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.fn_delete_user_pii(uuid, text, uuid, uuid, text) IS
  'KVKK DB-PII silme (Mimari A). auth.users''a DOKUNMAZ (GoTrue route''ta anonimleşir). Hard_delete + anonymize matrisi, tek transaction, idempotent, audit''li. EMAIL-anahtarlı silmeler p_user_email NULL ise atlanır.';
