# Cursor Görevi — KVKK data_export worker (Hobby + tek-JSON)

> 14 Haz 2026 · Claude mimari + adversaryal (8 güvenlik düzeltmesi bake edildi). Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude doğrulayacak.
> Sefa kararları: **Vercel=Hobby** (günlük cron + fire-and-forget tetik), **çıktı=tek JSON** (dep yok), **claim=exporting enum + reaper**, **TTL=7 gün**.

## Sorun
`data_export` talebi `kind='data_export', status='processing'` ile oluşuyor ama **hiçbir worker ZIP/JSON üretmiyor** → sonsuza "İşleniyor"da kalıyor. UI "dosyanı mail atarız" diyor (yalan vaat) → **KVKK m.11/g + m.13/2 (30 gün) ihlali.** Worker'ı sıfırdan kur.

## Çözüm — akış
`process-data-export` cron (Hobby: günde 1 + talep-anı fire-and-forget) → reaper (stuck 'exporting'→'processing') → claim (casUpdate processing→exporting) → user_id-scope'lu veri topla (açık beyaz-liste) → tek JSON → **private R2**'ye yükle → 7-gün signed link → enqueueMail → status=completed+result_path. + TTL purge + account_delete export'u da siler.

---

## 1) `storefront/supabase/migrations/189_kvkk_data_export_worker.sql` (YENİ)
```sql
-- Mig 189: KVKK data_export worker — 'exporting' claim status + export TTL kolonu.
-- enum ADD VALUE: yeni değeri AYNI tx'te KULLANMA (PG kısıtı). Bu migration sadece TANIMLAR;
-- index predicate'i 'exporting' KULLANMAZ (yalnız 'processing') → same-tx güvenli. result_path mig027'de VAR.
ALTER TYPE public.kvkk_request_status ADD VALUE IF NOT EXISTS 'exporting';
ALTER TABLE public.kvkk_requests ADD COLUMN IF NOT EXISTS result_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS kvkk_requests_export_claim_idx
  ON public.kvkk_requests(created_at)
  WHERE kind = 'data_export' AND status = 'processing';
```
> Yeni RPC yok → REVOKE/GRANT gerekmez. result_path'e DOKUNMA (var).

## 2) `storefront/src/lib/kvkk/collect-export-data.ts` (YENİ)
`collectUserExportData(admin, userId, email)` — **AÇIK BEYAZ-LİSTE, `*` SELECT YASAK** (yeni kolon eklenince sessiz sızıntı olmasın). Sorgular (hepsi user_id-scope):
- `profiles.select('display_name,phone,company_name,tax_office,tc,vkn,email_verified_at,created_at').eq('id',userId)`
- `addresses / customer_invoice_profiles / returns / reviews / support_tickets / proof_help_requests / notification_prefs / coupon_uses` → `.eq('user_id',userId)`
- `pim_conversations.select('display_name,history,facts,last_summary,created_at').eq('user_id',userId)`
- `orders.eq('user_id',userId)` → orderIds türet → `order_items / order_events .in('order_id',orderIds)`
- `email_subscribers.eq('email',email)`
- `design_files.select('id,original_name,mime_type,size_bytes,version,created_at,storage_path,storage_provider').eq('user_id',userId)` → her satıra **7-gün signed-link** üret: `storage_provider==='r2' || isR2StorageKey(storage_path) ? getSignedDownloadUrl(normalizeR2Key(storage_path), EXPORT_TTL) : admin.storage.from('designs').createSignedUrl(storage_path, EXPORT_TTL)`. **Çıktıya `storage_path` KOYMA** (iç yol); sadece `{original_name,mime_type,size_bytes,version,created_at,download_url,url_expires_at}`.
- **YASAK (sorgulama bile):** `wallet_*`, `loyalty_grants`, `referrals`, `audit_log`, `customer_notes`, `customer_tags`, `operator_note`/`archive_path`/`approved_by`/`revised_by_partner_id` (başka kişi/iç veri + Sefa cüzdan/puan kuralı).
- Çıktı: `{profile, addresses, invoice_profiles, orders, order_items, order_events, design_files[], returns, reviews, support_tickets, proof_help_requests, notification_prefs, pim_conversations, email_subscription, coupon_uses, exported_at}`.
> Desen: storage-purge.ts (orderIds türetme + design_files) + r2-client.getSignedDownloadUrl + admin.storage.createSignedUrl. `EXPORT_TTL = 604800` (AWS SigV4 max — **ARTIRMA**, büyük değer presigner exception).

## 3) `storefront/src/app/api/cron/process-data-export/route.ts` (YENİ)
Desen: `kvkk-delete-audit/route.ts` (assertCronAuth+withCronRun+maxDuration) + `process-mail-outbox` (reaper + per-row claim + try/catch-continue).
```
runtime='nodejs'; dynamic='force-dynamic'; maxDuration=300;
GET(req): assertCronAuth(req) → withCronRun('process-data-export', async () => {
  admin = service client; EXPORT_TTL = 604800;
  // (1) REAPER: stuck 'exporting' (30dk+) → 'processing' geri al
  await admin.from('kvkk_requests').update({status:'processing'})
    .eq('kind','data_export').eq('status','exporting').lt('updated_at', now-30dk);
  // (2) batch: processing data_export, limit 5
  const rows = .select('id,user_id').eq('kind','data_export').eq('status','processing').order('created_at').limit(5);
  for (row of rows) try {
    claim = casUpdate(admin,'kvkk_requests',row.id,{status:'exporting'},{expectFrom:'processing'});
    if (!claim.ok) continue;                          // başka instance aldı
    email = (await admin.auth.admin.getUserById(row.user_id)).user?.email;
    data = await collectUserExportData(admin, row.user_id, email);
    json = JSON.stringify(data, null, 2);
    key = `exports/${row.user_id}/${row.id}.json`;
    up = await uploadToR2({ key, body: json, contentType: 'application/json' });
    if (!up.success) { casUpdate(...,{status:'processing'},{expectFrom:'exporting'}); continue; } // retry
    url = await getSignedDownloadUrl(key, EXPORT_TTL, { downloadFilename:`pimetiket-verilerim-${row.id}.json` });
    expiresAt = new Date(now + EXPORT_TTL*1000);
    await enqueueMail({ templateKey:'customer_data_export_ready', to:email, category:'customer',
      targetType:'user', targetId:row.user_id, idempotencyKey:`data_export_ready:${row.id}`,
      payload:{ download_url:url, expires_at:expiresAt.toISOString(), request_id:row.id } });
    casUpdate(admin,'kvkk_requests',row.id,{status:'completed', result_path:key, result_expires_at:expiresAt.toISOString()},{expectFrom:'exporting'});
  } catch (e) { casUpdate(...,{status:'processing'},{expectFrom:'exporting'}); console.error(...); }
});
```
> **SIRA SABİT:** collect→upload→enqueue→complete (tersine dönerse crash'te mail gitmez/yarım-state). withCronRun advisory-lock + casUpdate satır-claim + idempotencyKey = üçlü idempotency.
> **Fire-and-forget tetik (Hobby):** Bu modülden `export async function triggerDataExportProcess()` (triggerMailProcess deseni — internal fetch `/api/cron/process-data-export` + CRON_SECRET header, fire-and-forget, hata yut). me/kvkk-requests POST'tan çağrılır (#8).

## 4) `storefront/src/lib/mail/templates.ts`
`renderCustomerDataExportReady(input)` ekle (renderLeadWelcome deseni): `download_url` https-validate (`new URL`+protocol guard, geçersizse buton render etme), `expires_at` tr-TR format, mercan buton "Verilerimi indir", body "Talep ettiğin tüm hesap verilerin tek dosyada hazır. Link 7 gün geçerli ({expires_at}), sonra güvenlik için otomatik silinir.", subject "Verilerin hazır — Pim Etiket". **RENDERERS map'e** `customer_data_export_ready: renderCustomerDataExportReady,` ekle (_prerendered'dan önce). DB whitelist yok → migration gerekmez.

## 5) `storefront/vercel.json`
- crons[]'a: `{ "path": "/api/cron/process-data-export", "schedule": "0 5 * * *" }` (**Hobby**: günde 1; `*/30` Hobby'de deploy-time reddedilir).
- functions{}'a: `"src/app/api/cron/process-data-export/route.ts": { "maxDuration": 300 }`.

## 6) `storefront/src/app/api/cron/purge-expired-designs/route.ts`
TTL purge dalı ekle (yeni cron değil — mevcut günlük purge'e): `kvkk_requests.select('id,user_id,result_path').eq('kind','data_export').eq('status','completed').not('result_path','is',null).lt('result_expires_at', now)` → her satır `deleteFromR2(result_path)` + başarılıysa `update({result_path:null}).eq('id',id)` (kayıt+audit kalır, R2 obje+path temizlenir — KVKK m.4 minimizasyon). Audit özetine `data_export_purged: N`.

## 7) `storefront/src/lib/kvkk/storage-purge.ts` — 🔴 KRİTİK PII-SIZINTI FİX
`purgeKvkkUserStorage` içinde (`purgeScope.full || purgeScope.profile` altında): `exports/${userId}/` prefix'ini `deleteR2Prefix` ile sil + `logPurgeEvent(resourceType:'data_export_bundle')`. **Yoksa** account_delete sonrası tüm-PII içeren export JSON'u R2'de kalır. `isR2StorageKey`'e `exports/` EKLEME (design_files purge'ünü yanıltır) — sadece explicit prefix-temizliği.

## 8) `storefront/src/app/ayarlar/verilerim/page.tsx`
- STATUS_LABEL Record'una (~56-66): `exporting: { label: "Hazırlanıyor", color: "bg-pim-mercan-tint text-pim-mercan" },` (yoksa enum genişleyince `STATUS_LABEL[r.status]` undefined → CRASH). KvkkRequestRow.status union'ına da `'exporting'`.
- Card metni (~327-336) "ZIP"→"tek dosya": "...tek dosya olarak hazırlayıp e-postana atarım." buton "Verilerimi iste". toast (~142) "ZIP hazır olunca"→"dosya hazır olunca".

## 9) `storefront/src/app/api/me/kvkk-requests/route.ts`
data_export INSERT'inden sonra (status='processing' yazıldıktan sonra): `void triggerDataExportProcess();` ekle (Hobby fire-and-forget — anında işle, cron yedek). triggerMailProcess çağrısının yanına/deseniyle.

---

## DİKKAT (adversaryal güvenlik)
- ❌ `collectUserExportData`'da `*` SELECT — açık kolon listesi GÜVENLİK SINIRI; design_files'tan storage_path/operator_note/archive_path/partner-id çıktıya KOYMA.
- ❌ wallet/loyalty/referral/audit_log/customer_notes/customer_tags export'a SOKMA (Sefa kuralı + başka-kişi verisi).
- ❌ `exports/` prefix'ini account_delete purge'üne eklemeyi ATLAMA (PII sızıntısı).
- ❌ EXPORT_TTL 604800'den BÜYÜK yapma (AWS SigV4 max → exception).
- ❌ Sıra tersine: MUTLAKA collect→upload→enqueue→complete.
- ❌ enum 'exporting'i AYNI migration'da kullanma (index predicate 'processing' only).
- ❌ R2 bucket public-access açma (signed-URL-only; doğrula Cloudflare'de public r2.dev/custom domain BAĞLI DEĞİL).
- ❌ `*/30` cron (Hobby reddeder) — `0 5 * * *`.
- ❌ Push etme.

## Sıra
1. Cursor: mig 189 canlıya uygula + `npm run supabase:types` + 8 dosya. `npm run build`. Commit (push yok).
2. Claude: mig 189 canlı (enum 'exporting' + result_expires_at) + verify-cursor-diff + **güvenlik elle teyit** (allowlist select, exports/-purge, TTL sabiti, sıra).
3. Manuel (Sefa): gerçek user_id ile cron tetikle → JSON üretildi mi, signed-link tek-key-scope mu, çift-mail yok mu, reaper stuck-row kurtarıyor mu.
