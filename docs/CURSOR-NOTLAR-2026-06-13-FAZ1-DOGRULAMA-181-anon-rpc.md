# Cursor Görevi — FAZ 1 Doğrulama Sonucu + Migration 181 (anon-RPC sertleştirme)

> 13 Haz 2026 · Claude bağımsız doğrulama + `anon-rpc-revoke-safety` workflow (13 ajan, adversaryal).
> Branch: `claude/file-review-updates-vnd6og`. FAZ 1 commit'leri (3f157775, c44f3773) **henüz push edilmedi.**

---

## 1) FAZ 1 doğrulandı — mantık/mimari SAĞLAM ✅

Claude FAZ 1'i bağımsız denetledi (kod + canlı DB salt-okunur probe):

| Boyut | Sonuç |
|---|---|
| orders.status doğrudan yazım | ✅ **SIFIR** — 27+ yazar `transitionOrderStatus`'a taşınmış (grep temiz) |
| CAS doğruluğu | ✅ `SELECT … FOR UPDATE` → `UPDATE … WHERE status=v_from` → `ROW_COUNT=0→stale_from` |
| Atomiklik | ✅ orders + order_events + audit_log **tek transaction** |
| Idempotency | ✅ `idempotency_key` ön-kontrol → `duplicate:true`; index canlıda |
| Matris | ✅ forward/bulk/admin_override/compensating; terminal (delivered/cancelled) kilitli |
| FAZ 0 uyumu | ✅ design_files/shipment index'i tekrar eklenmemiş; coupon_uses(coupon_id,user_id) eklenmiş |
| Objeler canlı DB'de | ✅ 5 fn + 3 index + idempotency_key kolonu mevcut; smoke `not_found` döndü |
| TS sarmalayıcı | ✅ `transition-order-status.ts` + `cas-update.ts` doğru (fason→staff, http 409/400/404) |

**Bu katmana kod değişikliği GEREKMİYOR.** Tek eksik aşağıdaki güvenlik kusuru.

---

## 2) 🔴 Tek kusur — anon EXECUTE açığı (push'tan önce kapat)

`fn_transition_order_status` (SECURITY DEFINER, RLS-bypass, sipariş-durumu mutatörü) **canlıda anon-çağrılabilir** çıktı. Sebep: mig 180 `REVOKE ALL … FROM PUBLIC` yazıyor, ama **Supabase default-privileges yeni public-şema fonksiyonlarına `anon`/`authenticated`'a DOĞRUDAN EXECUTE veriyor** — `FROM PUBLIC` bunu kaldırmıyor.

Canlı probe (Claude, Management API):
```
fn_transition_order_status   anon_exec=TRUE  auth_exec=TRUE  (SECURITY DEFINER)
fn_with_advisory_lock        anon_exec=TRUE  auth_exec=TRUE
fn_release_advisory_lock     anon_exec=TRUE  auth_exec=TRUE
fn_is_valid_order_forward…   anon_exec=TRUE  auth_exec=TRUE
fn_is_valid_order_bulk…      anon_exec=TRUE  auth_exec=TRUE
```

Risk: order id bilen biri `/rest/v1/rpc/fn_transition_order_status` ile başkasının provasını `proof_approved`'a çekebilir / sipariş iptal/shipped edebilir. Bu, FAZ 0'da bulduğumuz anon-RPC sınıfının (fn_validate_fason_token vb.) **aynısı**.

---

## 3) GÖREV — Migration 181 oluştur + canlıya uygula + commit

`anon-rpc-revoke-safety` workflow'u (13 ajan, her RPC bağımsız + adversaryal doğrulandı) **11 fonksiyonun da SAFE_TO_REVOKE** olduğunu, hiçbirinin reroute gerektirmediğini teyit etti (hepsi uygulamada yalnız service_role ile çağrılıyor). O yüzden FAZ 1 boşluğu + FAZ 2.6 anon-RPC bulguları **tek migration'da** kapatılıyor.

### 3a) Dosyayı oluştur: `storefront/supabase/migrations/181_anon_rpc_execute_hardening.sql`

```sql
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
```

**Neden DO-block:** tüm overload imzalarını otomatik yakalar, idempotent, `anon`'u adıyla içerir, matris fonksiyonlarına grant vermez.

### 3b) Canlı DB'ye uygula
Mig 180 ile aynı yöntem (`scripts/apply-migrations-180.mjs` deseni → `apply-migrations-181.mjs` veya mevcut Management API mekanizması). `.env.agent` içindeki `SUPABASE_ACCESS_TOKEN`, proje ref `ucmpwxnoaqjpzhijnxtp`.

### 3c) Commit et — **PUSH YOK**
```
git add storefront/supabase/migrations/181_anon_rpc_execute_hardening.sql storefront/scripts/apply-migrations-181.mjs
git commit -m "fix(security): mig 181 — anon/authenticated RPC EXECUTE revoke (FAZ1 fn + 6 legacy anon-açık RPC)"
```
**Push ETME.** Claude canlıdan 11 fonksiyonun `anon_exec=false` olduğunu re-probe edip teyit edecek; temizse FAZ 1 (3f157775 + c44f3773 + 181) **birlikte** pushlanacak.

---

## 4) Neden güvenli — workflow kanıt özeti (her RPC bağımsız + adversaryal)

| RPC | Tek çağrı yolu (hepsi service_role) | Revoke edilirse |
|---|---|---|
| `fn_transition_order_status` + advisory-lock (3 fn) | `transition-order-status.ts` / `cron-logger` — `createAdminClient()` | hiçbir şey kırılmaz |
| `fn_is_valid_order_forward/bulk_transition` (2 fn) | uygulamada hiç çağrılmıyor; yalnız fn_transition SQL gövdesi | hiçbir şey kırılmaz |
| `fn_validate_fason_token` | `/api/fason/{update,info,download}` — `createClient(serviceKey)` | hiçbir şey kırılmaz |
| `fn_complete_referral` | callback:468 + recover-pending-intent:97 — `createAdminClient()` | M10-K2 deliği kapanır |
| `fn_apply_referral_code` | auth/callback:56-57 — `createAdminClient()`; trigger yolu (mig143) SECURITY DEFINER grant'tan bağımsız | hiçbir şey kırılmaz |
| `fn_refresh_fason_scores` | cron route — `createClient(serviceKey)` + assertCronAuth | M10-Y3 DoS deliği kapanır |
| `fn_suggest_fason_partner` | **hiç çağrılmıyor** (fn_find_best_partner'a devredilmiş) | M10-Y3 tedarikçi-istihbarat sızıntısı kapanır |
| `fn_enqueue_mail` | `enqueue.ts:65` — `createAdminClient()` | mail-spam/KVKK deliği kapanır |

**Kritik nüans:** `fn_enqueue_mail` için eski mig'ler (035/037/076) sadece `from public, authenticated` revoke etmiş, `anon`'u adıyla yazmamış → canlıda anon grant'ı hayatta. Mig 181 DO-block'u `anon`'u adıyla içerdiği için bunu da kapatır.

---

## 5) DİKKAT (yapma listesi)
- ❌ Migration 180'e dokunma (commit'li, mantığı doğru).
- ❌ Push etme — Claude teyit edecek.
- ❌ Fonksiyon imzalarını elle yazıp REVOKE etme (overload riski) — DO-block kullan.
- ❌ service_role GRANT'ını kaldırma — uygulama bu RPC'leri service_role ile çağırıyor, kalmalı.
- ✅ Yalnızca yeni migration 181 + apply script + commit.
