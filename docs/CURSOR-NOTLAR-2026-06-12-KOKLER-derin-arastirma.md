# 🔬 KÖKLER — Derin Araştırma Dosyası (12 Haziran 2026)

> Kapanış özetindeki 6 sistemik kök desen, TÜM kod tabanında kapsamlı (census) araştırıldı.
> Amaç: her kökü kaynakta çözecek **paylaşılan altyapı**yı tasarlamak (uygulamadan). SADECE analiz.
> Bu dosya, modül notlarındaki ~280 örneklem bulgunun **arkasındaki tek tek kaynakları** ve
> "tek değişiklikle çok bulgu kapatan" kaldıraç noktalarını verir.

---

## KÖK-1 — Koşulsuz read-then-write (TOCTOU) · ~48 doğrulanmış

**Desen:** `.select()` ile durum okunur → JS'te kontrol → `.update()` yalnız `.eq("id")` ile (kontrol edilen kolona CAS yok). İki eşzamanlı istek/cron+istek lost-update üretir.

### Choke-point gerçeği
Kod tabanında **3 idiom bir arada**: row `FOR UPDATE` (ödeme/kupon/fason RPC'leri), partial unique index (refund/returns/fason-assign/outbox), lock-free CAS (`fn_finalize_proof`'ta `UPDATE...WHERE status=... + ROW_COUNT`). Desen **evde var ama tutarsız uygulanıyor.**

### ⚠️ İki YIKICI TOCTOU (yeni — tek `.eq()` yetmez, transaction/RPC gerekir)
- **`admin/staff/[userId]/route.ts:93` (PATCH) + `:162` (DELETE):** "son super_admin" invariant'ı (count≤1 kontrolü) ile demote/sil arası yarış → iki eşzamanlı demote **sıfır super_admin** bırakıp tüm sistemi kilitleyebilir. App-level read-then-write; **transactional RPC** gerekir. (KRİTİK — kalıcı yetki kaybı)
- **`admin/kvkk-requests/[id]/process/route.ts:132`:** yıkıcı yan-etkiler (storage purge, chat delete) status UPDATE'inden **ÖNCE** çalışıyor → çift-process veriyi **iki kez siler**. `.eq("status", row.status)` + 0 satırda yan-etki iptali. (KRİTİK — geri dönüşsüz)

### Doğrulanmış TOCTOU — API route'ları (8, hepsi tek `.eq()` ile çözülür)
| dosya:satır | güncellenen | eklenecek CAS |
|---|---|---|
| `proof-respond/route.ts:89` | orders.status | `.eq("status","proof_pending")` |
| `partner/.../decide/route.ts:200` | order_items.proof_status | `.eq("proof_status", item.proof_status)` |
| `partner/.../decide/route.ts:257` | order_assignments.status | `.eq("status", assignment.status)` |
| `design/upload-complete/route.ts:222` | design_files.status | `.eq("status", fileRow.status)` |
| `design/upload-complete/route.ts:270` | orders.status | `.eq("status", orderRow.status)` |
| `fason/download/[token]/route.ts:177` | assignment ack | `.is("acknowledged_at", null)` |
| `admin/orders/[id]/upload-design/route.ts:238` | orders.status | `.eq("status", currentStatus)` |
| `admin/help-requests/[id]/respond/route.ts:96` | proof_help_requests.status | `.eq("status", hr.status)` |

### Doğrulanmış TOCTOU — lib/ (en ağır kümeler)
- **`storage/archive-service.ts` (94,247,298,330,346,355,388) + `restore-service.ts` (110,126,135,140,145,150):** arşiv↔restore↔cron yarışı; `archive_status` geçişleri CAS'siz. `archive-service.ts:94` yorumu "race koruması" diyor ama yazımda guard YOK (yanlış güven). **En yüksek eşzamanlılık riski.**
- **`proof/orchestrator.ts` (210,240,292,309,333,352):** orders.status proof geçişleri CAS'siz → eşzamanlı `cancelled` write'ını ezip **iptal siparişi proof_pending'e diriltir.**
- **`agents/run-order-qc.ts` (132,159,449,463):** QC status geçişleri CAS'siz (449 kod-gate var ama write CAS'siz).
- **`fason/revoke-assignment.ts` (124,164), `apply-assignment-action.ts:239`:** FSM + order status CAS'siz.
- **Idempotency-sınıfı (tek-atış guard yarışla yeniliyor):** `support/classify-ticket.ts:94` (`ai_classified_at`), `mail/notifications.ts:1523` (`welcome_sent_at`), `agents/_shared/proposal.ts:180` (approved→applied çift-çalıştırma), `payment/recover-pending-intent.ts:146` (kardeşi `:312` CAS'li — tutarsız).
- **Lost-update (CAS değil RPC gerektirir):** `reviews.ts:179` (sayaç++), `agents/actions/extend-coupon-expiry.ts:71` (expires_at read-compute-write).
- **jsonb `meta` clobber (ayrı sınıf, jsonb-merge RPC gerekir):** `orchestrator.ts:112`, `proof/print-ready.ts:660`, `editor/promote-editor-cutline.ts:69,123`.
- **`customer-profile.ts:266,286`:** `is_default` 2-adımlı flip atomik değil → RPC/trigger'a taşı.

### Zaten doğru (CAS var — örnek alınmalı)
`cancel/route.ts:81`, `advance-status/route.ts:72`, `ai-qc/decide:101`, `proof/[itemId]/view:59`, `approve:180` (`.in("status",[draft,auto_generated])`), `redistribute-slot:201,232` (`.eq("qty",...)`), `payment/init:351`, `process-mail-outbox:246` (atomik claim), `run-order-qc:524`, `resume-order-pipeline:71/88/107/125`.

### ➡️ Paylaşılan altyapı: CAS-update helper
```ts
// src/lib/db/cas-update.ts
async function casUpdate<T>(q: PostgrestFilterBuilder, opts:{expectFrom:string|string[]; col?:string}):
  Promise<{ ok:true; row:T } | { ok:false; reason:"stale" }>
// .eq/.in(col, expectFrom) + .select() ekler, 0 satır → {ok:false,"stale"} → çağıran 409 döner
```
**Kaldıraç:** ~48 site, her biri tek `.eq()`/`.is()` ile çözülür; helper + CI grep-guard (`\.from\(...\)\.update.*status` transition modülü dışında yasak) yeni bypass'ı engeller.

---

## KÖK-2 — `orders.status` merkezi geçiş otoritesi yok · 29 yazar

**Gerçek:** `order.ts`'te `VALID_SINGLE_TRANSITIONS`/`getValidTransitions`/`isForwardStatusTransition` VAR ama yalnız **2 yazar** (advance-status, bulk-status) kullanıyor. Diğer **27** bypass ediyor.

### Yazar census (özet — 29 grup, ~45 fiziksel write)
- **Uygulama TS (21):** admin status:84 (**serbest set, matris+CAS yok**), bulk-status:86 (matris var), advance-status:72 (CAS+matris ✅), admin-bypass-promote:65, upload-design:238, upload-proof:177, tracking:240, ai-qc:101 (CAS✅), **proof-respond:89 (atlama)**, upload-complete:270, cancel:81 (CAS✅)+rollback, auto-refund:90 (CAS✅)+rollback, run-order-qc (5 write, çoğu CAS'siz), run-order-cutline:320 (CAS✅), resume-pipeline (CAS✅), **orchestrator (7 write, CAS'siz)**, apply-assignment:281 (CAS'siz), revoke:164, cancel-no-design:42 (CAS✅), promote-temp:364 (CAS✅).
- **RPC (3):** `fn_create_order` (INSERT paid), `fn_finalize_paid_order` (idempotent+FOR UPDATE ✅), `fn_finalize_proof` (CAS+owner ✅), `fn_assign_order_to_fason` (**en güçlü guard**: cancelled/delivered/proof_pending raise).
- **DB Trigger (3):** paid→proof_pending/awaiting_upload, design-upload→qc_pending, cutline→proof_pending; +1 koşullu auto-assign (varsayılan kapalı).

### Matris-dışı / çelişen GERÇEK geçişler
| Geçiş | Yazar | Sorun |
|---|---|---|
| `proof_pending → in_production` | proof-respond:89 | **MATRİSTE YOK** — proof_approved/ready_to_ship/fason_assigned + operatör kapısı **atlanıyor** |
| `proof_pending → operator_review` | orchestrator:309, proof-respond | matriste yok |
| `paid/qc_pending/... → in_production` | fn_assign_order_to_fason legacy dal | matriste yok |
| `* → herhangi` | admin status:84 | matris tamamen bypass (geriye+terminal dahil) |
| **`* → delivered`** | **YAZAR YOK** | poll-shipments yalnız `assignment.tracking_status` yazıyor → `delivered`'a otomatik geçiş **hiç yok**; yalnız manuel admin (M5/M7-B7 kökü) |

### ➡️ Paylaşılan altyapı: tek chokepoint `fn_transition_order_status`
DB RPC + ince TS wrapper. SQL'de olmalı çünkü trigger'lar + 3 RPC zaten DB'de yazıyor.
```ts
transitionOrderStatus({ orderId, from: OrderStatus|OrderStatus[], to, actor, reason,
  mode?: "forward"|"compensating"|"admin_override", extra? })
  → { ok:true } | { ok:false, error:"stale_from"|"invalid_transition"|"terminal"|"not_found" }
```
SQL gövdesi tek txn'de: **(1) CAS** `UPDATE...WHERE status=ANY(from)` (TOCTOU kapanır) → **(2) matris** `fn_is_valid_transition` (forward modda) → **(3) terminal koruma** → **(4) otomatik `order_events`** (13+ elle log tekilleşir) → **(5) audit** (admin/staff) → **(6) yan kolonlar** (`qc_attempt_count`/`proof_uploaded_at`/`shipped_at`).
**Kademeli migrasyon:** Faz0 RPC ekle → Faz1 guard'sız yazarları (orchestrator/run-order-qc/proof-respond/admin) → Faz2 CAS'lileri sarmala → Faz3 trigger+RPC içeriden + CI grep-guard.
**Kaldıraç:** 17 guard'sız write'taki TOCTOU + tüm matris-dışı geçişler + eksik event loglama tek noktadan kapanır. proof-respond atlaması ya resmîleşir ya override damgası alır.

---

## KÖK-3 — DB yazıldı ama fiziksel/yan-etki doğrulanmadı

**Desen:** DB status değişir (`superseded`/`deleted`/`cold`), R2/storage/event/mail senkronlanmaz veya varlığı doğrulanmaz → orphan/drift.

### Census (modül + R3 census birleşik)
- **Superseded orphan:** `proof/[itemId]/background/remove:120`, `enhance/accept:121` — eski satır `superseded` ama R2 objesi silinmiyor; `purge-expired` RPC'sinin superseded path'leri kapsadığı **kanıtsız** (M11-B3).
- **Cron storage silmiyor:** `fn_cleanup_temp_designs` (Mig 008:124) yalnız DB row siler, storage "TODO" → enhance/bg-remove orphan'ları kalıcı (M3-#9).
- **DB PII silinmiyor:** `kvkk/storage-purge.ts:561` yalnız `profiles.archive_status="deleted"`; addresses/orders snapshot/payments/auth email yerinde (M14-B1, **yasal**).
- **Yanlış silme:** `cleanup-stale-uploads:42` R2-direct gerçek dosyayı HeadObject doğrulamadan siler (M11-B2).
- **Restore ölü URL:** `restore-service.ts:72` R2'de obje var mı bakmadan signed URL üretir, audit "başarılı" der (M11-B12).
- **Yan-etki best-effort:** `logOrderEvent`/mail çoğu yerde `void`/await'siz; `apply-assignment:278` (orders shipped update hatası yutulur), auto-refund:227 (refund yapıldı event throw'da yutulur).
- **shipped/delivered drift:** poll-shipments assignment'a yazar, orders.status'a yazmaz (KÖK-2 ile aynı).

### ➡️ Çözüm deseni
Silme/promote/arşiv adımlarını **idempotent + doğrulamalı** yap: fiziksel işlem öncesi/sonrası `getR2ObjectInfo().exists` kontrolü; DB-mark ile fiziksel-iş tek RPC/transaction veya telafi kuyruğu (`purge_retry`); event insert'i kritik kabul et (await + hata kontrolü).

---

## KÖK-4 — Idempotency / tek-instance koruması eksik

### En büyük gerçek: `withCronRun` KİLİT DEĞİL
`cron-logger.ts:61` yalnız `cron_runs`'a "running" satırı insert ediyor — mevcut "running"i kontrol etmiyor. DB'de **`pg_advisory_lock`/`SKIP LOCKED` SIFIR kullanım** (greenfield). 22 cron'un tek-instance güvenliği yalnız handler-içi DB CAS/upsert'ten geliyor (varsa).
- **Korumalı (handler CAS):** process-mail-outbox:246 (atomik claim ✅), poll-shipments:134 (upsert ✅), auto-refund (RPC CAS).
- **Korumasız reminder cron'ları (doğrulandı):**
  - `approval-reminder:102` mail ÖNCE gönderiliyor, `reminded_at` CAS SONRA → paralel cron çift mail (claim-then-send'e çevir).
  - `upload-reminders:135` ve `detect-abandoned-carts` (`sendAbandonedCart`) `enqueueMail`'e **`idempotencyKey` GEÇMİYOR** → Mig 076 UNIQUE index fiilen devre dışı, yalnız SELECT-dedup (yarışa açık). `fason-deadline-reminder:176` doğru geçiriyor (örnek).
  - archive-inactive CAS'siz → çift R2 yazımı.

### In-memory cross-request state (serverless'te etkisiz)
- `rate-limit.ts:52` memoryStore (Upstash yoksa per-instance — OTP/AI rate-limit çöker).
- `resume-order-pipeline.ts:24` `lastResumeAt` cooldown → çift QC schedule.
- (Cache'ler benign: pricing-config, pricebook, maintenance.)

### Eksik/doğrulanacak unique index
- **MISSING:** `cron_runs` `(cron_name) WHERE status='running'` — KÖK-4'ün ana kökü.
- **`order_events`** idempotency key yok ("constraint" migration'ları yalnız event_type CHECK'i) → çift status event.
- **⚠️ DOĞRULA (promote/poll bunlara güveniyor):** `design_files(order_id,order_item_id,version)` ve `shipment_status_events(order_id,status,event_time)` — comment'te iddia, migration'da teyit edilmedi. Yoksa eşzamanlı promote/poll duplike insert.
- **VAR (sağlam):** payments idempotency_key + refund partial unique, coupon_reservations(payment_intent_id), order_assignments one-active, returns one-pending, mail_outbox/suppressions idempotency.

### ➡️ Paylaşılan altyapı
```sql
-- withAdvisoryLock: pg_try_advisory_xact_lock(hashtext(p_key)) → false ise bail
```
`withCronRun`'a advisory lock ekle (tek değişiklik 22 cron'u korur) + reminder cron'larına `SKIP LOCKED` dequeue + 2 unique index'i teyit/ekle.

---

## KÖK-5 — Koruma var ama yanındaki yollar bypass · 6 guard

| Guard | Yol | Bypass | Choke-point? |
|---|---|---|---|
| `redactOrderAddressForPartner` | 6 | **2 meta** (`partner/orders/[id]:212`, `fason/info/[token]:71`) + notes | ❌ |
| `enqueueMail` suppression | ~12 | **~11 doğrudan `sendMail`** (agent/denetçi/test/KVKK mailleri) | ❌ |
| `isGlobalAiBudgetExceeded` | ~14 | **~10** (gpt-4o vision/validator/design-qc dahil en pahalılar) | ❌ |
| **`assertPermission`** | 126 | 1 (deprecated grant-credit) | ✅ **tek sağlam** |
| `assertProofOrderAccess` | 5 | **1** (`save-edit` elle, admin/staff dalı sapması) | ❌ |
| `detectMimeFromMagicBytes` | ~12 | **5** (en kritik: `partner upload-revision:165` — magic-byte yok + admin-loop atlayıp `status:'approved'` müşteriye) | ❌ |

**En kritik:** partner upload-revision (içerik doğrulamasız müşteriye servis); AI bütçe (en pahalı çağrılar guard'sız → $5/gün garantisi sahte); meta iki endpoint'te redaksiyonsuz.

### ➡️ Çözüm: her guard'ı tek choke-point'e topla
- Mail: tüm `sendMail` çağrılarını `enqueueMail`'e (veya `enqueueMail`'e `skipSuppression` flag'i) yönlendir.
- AI: `assertAiBudget()` helper'ı her `generateObject/Text`'ten önce.
- Magic-byte: signed-URL upload'ları server-side multipart/completion-callback'e çevir; partner upload-revision'a magic-byte + admin-loop zorunlu.
- Proof access: save-edit'i `assertProofOrderAccess`'e geçir.
- Redaksiyon: partner payload'ında `redactItemMetaForPartner` whitelist.

---

## KÖK-6 — Yorum-kod / docs-kod / kaynak drift'i

- **Migration sayısı:** docs 6 yerde "89" der, gerçek **176** (`CLAUDE.md`, `AGENTS.md`, `DOMAIN-SCHEMA-REFERENCE`, `SCHEMA-TYPES-AGENT-GUIDE`, `BEKLEYEN-ISLER`, `supabase/README`).
- **`MIGRATIONS-APPLIED.md` ~089'da kalmış** → 090-176 apply durumu hiçbir yerde takip edilmiyor. **M9/M10/M14'teki "canlı ACL doğrula" maddelerinin kökü bu boşluk.** (Çözülen: Mig 076 uygulanmış olarak kayıtlı → M12-B12 ✅ giderildi; ama dosya içi "APPLY BEKLİYOR" notu silinmemiş.)
- **Uygulanmamış görünen ama uygulanmış migration'lar:** `075`,`076` dosya içi "APPLY ONAYI BEKLİYOR" notu duruyor (yanıltıcı). `077` bilinçli uygulanmadı (server proxy).
- **Yanlış yorumlar:** `archive-service.ts:94` "race koruması" (yok), `webhooks/resend:267` "replay korumalı" (yok), `auto-refund:6-8` eski SLA mantığı, `etiket-pricing.ts:10` "max 50000" (gerçek 10000).
- **8 `@deprecated` export hâlâ canlı:** `notifications.ts:1329`, `cost.ts:101`, `etiket-pricing.ts:4`, `blog-posts.ts:130`, `pricing-dual-price.ts:66,79`, `r2-client.ts:48`, `navigation-tools.ts:365`.

### ➡️ Çözüm: tek `npm run context:map` + `MIGRATIONS-APPLIED.md`'yi 176'ya tamamla; uygulanan migration'ların dosya-içi "BEKLİYOR" notunu sil; CI'da migration-sayısı↔docs senkron testi.

---

## 🎯 EN YÜKSEK KALDIRAÇLI 6 ALTYAPI (sırayla)

| # | Altyapı | Kapattığı | Etki |
|---|---|---|---|
| 1 | **`fn_transition_order_status` chokepoint** (KÖK-2) | 27 yazar + 17 TOCTOU + matris-dışı geçiş + event drift | 🔴 Çekirdek akış |
| 2 | **`withCronRun`'a advisory lock** (KÖK-4) | 22 cron tek-instance | 🟠 Tüm arka plan |
| 3 | **`casUpdate` helper + CI grep-guard** (KÖK-1) | ~48 TOCTOU (orders dışı: archive/restore/qc/idempotency) | 🟠 Veri bütünlüğü |
| 4 | **Guard choke-point'leri** (KÖK-5) | mail/AI/magic-byte/meta bypass'ları | 🟠 Güvenlik+para |
| 5 | **2 unique index teyit + `order_events` idempotency** (KÖK-4) | promote/poll/event duplike | 🟡 Doğrula-önce |
| 6 | **DB↔fiziksel doğrulama + telafi kuyruğu** (KÖK-3) | orphan/yanlış-silme/KVKK | 🟡 + yasal |

## Bağımlılık notu (önce teyit)
Tüm bu altyapı önerileri **canlı DB teyidi** gerektiren maddelere bağlı (KÖK-6 boşluğu): 090-176 migration apply durumu, 2 unique index varlığı, Supabase RPC ACL'leri, Vercel plan (maxDuration). Çözüm oturumundan önce `MIGRATIONS-APPLIED.md` 176'ya tamamlanmalı.
