# Cursor Görevi — FAZ 2 / KVKK m.7: DB-PII silme (Migration 182 + route wiring)

> 13 Haz 2026 · Claude mimari + 2 çok-ajanlı tarama (PII envanteri 35+ tablo → tasarım → **adversaryal kritik** → şema-doğru SQL üretimi → **adversaryal doğrulama `sound`**).
> Branch: `claude/file-review-updates-vnd6og`. **Launch-blocker yasal iş** (KVKK m.7 ihlali sürüyor).

---

## 0) Bağlam — sorun + mimari karar

**Sorun (M14-B1/B2):** KVKK "hesap silme" tamamlanınca yalnız depolama + `archive_status='deleted'` bayrağı atılıyor; **DB'deki PII (profiles, addresses, orders.address JSON, payments, support, bülten, CRM...) ne siliniyor ne anonimleştiriliyor.** Müşteriye "adreslerin/sipariş geçmişin silinir" deniyor, karşılanmıyor → KVKK ihlali + yanıltıcı beyan.

**Kritik bulgu (neden "auth user'ı sil" YAPMIYORUZ):** `auth.admin.deleteUser` çağırmak, auth.users'a `ON DELETE CASCADE` bağlı ~15 tabloyu (returns/coupon_uses/payment_intents/loyalty_grants/reviews...) **komple siler → VUK m.253/TTK m.82 10-yıl mali kayıtlar yok olur** (yeni ihlal); RESTRICT/NO-ACTION FK'ler silmeyi **bloklar → email hiç silinmez**.

**Sefa kararı — MİMARİ A (anonimleştir):**
- `auth.users` **SİLİNMEZ** → GoTrue `auth.admin.updateUserById` ile **anonimleştirilir** (email→tombstone, phone→null, metadata temizle, ban). **ROUTE'ta** yapılır, RPC'de değil.
- `deleteUser` çağrılmaz → CASCADE tetiklenmez → **FK cerrahisi YOK**, retain tablolarında **user_id NULL'lanmaz** → NOT NULL ihlali riski sıfır.
- **reviews → ELLENMEZ** (Sefa kararı: retain_asis).

Bu, KVKK m.7 + m.28 (yasal saklama için anonimleştirme istisnası) ile tam uyumlu.

---

## 1) GÖREV A — Migration 182 oluştur + canlıya uygula + commit

`storefront/supabase/migrations/182_kvkk_delete_user_pii.sql` (yeni). **Tam SQL aşağıda** — her kolon adı + NOT NULL kısıtı şemadan teyitli, adversaryal doğrulandı (`sound`). Olduğu gibi kullan:

```sql
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
  p_kvkk_request_id uuid,
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
    'profile.delete'::public.audit_action, 'kvkk_request', p_kvkk_request_id::text,
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
```

**Uygula:** mig 180/181 ile aynı yöntem (`apply-migrations-182.mjs`, Management API). Fonksiyon oluşturmak **veri silmez** (yan etkisiz) — sadece tanımlar. Commit et, **push YOK** (Claude doğrulayacak).

---

## 2) GÖREV B — Route wiring (Mimari A akışı)

### Ortak yardımcı (DRY — önce bunu yaz): `src/lib/kvkk/delete-user-pii.ts`
```ts
// admin = service_role client. RPC + GoTrue anonimleştirmeyi tek yerde topla.
export async function deleteUserPiiAndAnonymizeAuth(
  admin: SupabaseClient,
  args: { userId: string; email: string | null; kvkkRequestId: string | null; actorId: string | null; actorRole?: "admin" | "customer" }
): Promise<{ ok: true } | { ok: false; stage: "rpc" | "auth"; message: string }> {
  const { data, error } = await admin.rpc("fn_delete_user_pii", {
    p_user_id: args.userId, p_user_email: args.email,
    p_kvkk_request_id: args.kvkkRequestId, p_actor_id: args.actorId,
    p_actor_role: args.actorRole ?? "admin",
  });
  if (error) return { ok: false, stage: "rpc", message: error.message };
  // GoTrue anonimleştir — auth.users SİLİNMEZ
  const { error: authErr } = await admin.auth.admin.updateUserById(args.userId, {
    email: `deleted-${args.userId}@deleted.invalid`,
    phone: null, user_metadata: {}, app_metadata: {},
    ban_duration: "876000h", // ~100 yıl (kalıcı ban). GoTrue "none" ile geri alınır.
  });
  if (authErr) return { ok: false, stage: "auth", message: authErr.message };
  return { ok: true };
}
```

### DOSYA 1 — `src/app/api/admin/kvkk-requests/[id]/process/route.ts` (COMPLETE dalı)
Storage purge'den **SONRA**, `kvkk_requests` status update'inden **ÖNCE**, `account_delete` için:
```ts
if (row.kind === "account_delete") {
  // 1) Email OKU (RPC'den önce — auth.users henüz dokunulmamış)
  const { data: u } = await admin.auth.admin.getUserById(row.user_id);
  // 2) RPC + GoTrue anonimleştir
  const res = await deleteUserPiiAndAnonymizeAuth(admin, {
    userId: row.user_id, email: u?.user?.email ?? null,
    kvkkRequestId: id, actorId: auth.user.id, actorRole: "admin",
  });
  if (!res.ok) return NextResponse.json({ error: `KVKK silme (${res.stage}): ${res.message}` }, { status: 500 });
}
```
Sıra: **email oku → (mevcut) storage purge → RPC → GoTrue anonimleştir → kvkk_requests completed.** Hepsi retry-safe (RPC idempotency guard'lı, updateUserById idempotent).

### DOSYA 2 — `src/app/api/customer/kvkk-archive-delete/route.ts` (tutarlılık)
Şu an SADECE storage purge yapıyor → DB-PII bırakıyor (aynı eksik). Aynı yardımcıyı ekle:
- `account_delete` kind'ında `deleteUserPiiAndAnonymizeAuth` çağır (purge sonrası).
- Email: self-delete'te `user.email` zaten elde; admin-acting'te `getUserById(targetUserId)`.
- `actorRole`: self ise `"customer"`, admin ise `"admin"`.
- `kvkkRequestId`: `assertKvkkR2DeleteEligible`'dan dönen request id (varsa) yoksa `null` (audit target_id nullable).

---

## 3) Uygulanan iyileştirmeler (doğrulama mustFix → SQL'e katıldı)
- ✅ `orders.address`'ten **`label` de siliniyor** (nadir isim sızıntısı kapandı).
- ✅ Audit'e **`p_actor_role` param** (admin vs self-delete doğruluğu; CHECK-guard'lı).

## 4) Bilinçli RETAIN kararları (kod değil — belge)
- `mail_suppressions` (bounce/şikayet listesi): **SAKLANIR** — silinirse o adrese tekrar mail riski (ticari e-ileti ihlali). E-posta operasyonel/yasal gereklilik.
- `kvkk_requests.user_note/request_ip/user_agent`: **SAKLANIR** — talebin yapıldığının kanıtı (KVKK m.7 hesap verebilirlik). Silme kanıtını silmek çelişki olur.
- `reviews`: **ELLENMEZ** (Sefa kararı — yorum içeriği korunur).

## 5) Takip işleri (BU görevin DIŞINDA — ayrı sıraya)
1. **Geriye dönük backfill:** eski `completed` account_delete talepleri Mig 041 ile sadece display_name+phone temizlendi → hâlâ PII tutuyor. Tek seferlik script: tüm completed account_delete için `fn_delete_user_pii` + GoTrue anonimleştir.
2. **Mig 041 `fn_process_kvkk_deletion` + agent action `process-kvkk-deletion.ts` ARTIK eksik/yanıltıcı** (yalnız display_name+phone). Auditor yolunu yeni RPC'ye yönlendir veya eski RPC'yi deprecate et (route tek-doğruluk olsun).
3. **partial_delete scope-bazlı silme:** v1'de RPC sadece `account_delete`'e bağlı; partial_delete için scope-seçici varyant ileride.
4. **(Ayrı KVKK açıkları — vaat var, kod yok):** data_export ZIP worker YOK (talep sonsuz "İşleniyor"), VUK 10-yıl oto-silme cron YOK (sadece sayım).

## 6) DİKKAT (yapma listesi)
- ❌ `auth.admin.deleteUser` ÇAĞIRMA (CASCADE mali kayıtları siler / RESTRICT bloklar). Sadece `updateUserById` anonimleştir.
- ❌ FK constraint'leri değiştirme (CASCADE→SET NULL migration YOK — Mimari A'da gereksiz).
- ❌ Retain tablolarında `user_id`'ye dokunma (NOT NULL ihlali → rollback).
- ❌ `reviews` tablosuna dokunma.
- ❌ Push etme — Claude canlıdan fonksiyon+grant doğrulayacak, sonra karar.
- ✅ Migration 182 + apply script + `delete-user-pii.ts` helper + 2 route + commit.

## 7) Sıra
1. Cursor: mig 182 + helper + 2 route + apply (fonksiyon oluştur, veri silmez) + commit (**push yok**).
2. Claude: canlıdan `fn_delete_user_pii` var mı + imza + grant (anon/auth=false) doğrula.
3. **Merge/deploy ÖNCESİ ZORUNLU:** staging/test hesapla gerçek silme dry-run (GoTrue ban davranışı + self-delete oturum sonu). Bu olmadan prod'a (main) MERGE ETME — geri-dönülmez PII silme.
