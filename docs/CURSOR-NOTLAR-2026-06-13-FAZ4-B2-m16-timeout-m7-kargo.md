# Cursor Görevi — FAZ 4 Batch 2: M16 dış-API timeout + M7 kargo poll birleştirme

> 13 Haz 2026 · Claude mimari + adversaryal (gerçek holes düzeltildi). Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude doğrulayacak.

## Kapsam
| # | Bulgu | Severity | Migration |
|---|---|---|---|
| M16 | dış-API timeout + helper-bug | medium | yok |
| M7 | kargo poll birleştirme + dedup | **high** | **187** |

2 commit önerilir. Her biri `npm run build`.

---

## M16 — dış-API timeout (migration yok)
> Adversaryal: idempotency-key (Replicate'te YOK) + scale-dedup (uygulanamaz) + search-engine-ping.ts (ölü kod) **çıkarıldı**. Asıl iş: helper-bug fix + timeout kapsama.

### ⚠️ ÖNCE: `src/lib/http/fetch-with-timeout.ts` — gizli bug fix (KRİTİK)
`isFetchTimeoutError` (~18-20) `err.name === 'AbortError'` bakıyor; ama `AbortSignal.timeout()` undici'de **`TimeoutError`** fırlatır → bugün PayTR/Netgsm/Yurtici **her timeout'u yanlış sınıflıyor**. Düzelt:
```ts
return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
```
`fetchWithTimeout` fonksiyonuna DOKUNMA (doğru).

### `src/lib/http/external-timeouts.ts` — sabitler ekle (mevcut N_000 deseni)
```ts
export const INSTAGRAM_HTTP_TIMEOUT_MS = 8_000;
export const GSC_HTTP_TIMEOUT_MS = 15_000;
export const INDEXNOW_HTTP_TIMEOUT_MS = 10_000;
export const GA4_REPORT_TIMEOUT_MS = 20_000;
```

### Timeout'suz fetch'leri sar (`fetchWithTimeout` + ilgili sabit)
- `src/lib/instagram/fetch-media.ts:23` → `{ next:{revalidate:3600}, timeoutMs: INSTAGRAM_HTTP_TIMEOUT_MS }` (fallback get-home-feed.ts:62-73 catch'te slot'a düşüyor — render-blocking değil, ama API-route sızıntısı kapanır)
- `src/lib/instagram/token.ts:111` → `{ timeoutMs: INSTAGRAM_HTTP_TIMEOUT_MS }`
- `src/lib/instagram/sync-slots.ts:46` → `{ timeoutMs: INSTAGRAM_HTTP_TIMEOUT_MS }` + loop içi try/catch (timeout o slotu atlasın, cron'u düşürmesin)
- SEO/GSC (`submitGscSitemap` fetch'i) → `GSC_HTTP_TIMEOUT_MS`; IndexNow → `INDEXNOW_HTTP_TIMEOUT_MS`; GA4 report fetch → `GA4_REPORT_TIMEOUT_MS` (mevcut çıplak fetch'leri grep'le bul, fetchWithTimeout ile sar)
> `search-engine-ping.ts`'e DOKUNMA (ölü kod — prod yolunda hiç çağrılmıyor).

### `src/lib/design/image-upscale.ts` — Replicate tek wall-clock deadline
Fonksiyon başında (token sonrası): `const deadline = Date.now() + REPLICATE_UPSCALE_TIMEOUT_MS; const remaining = () => Math.max(0, deadline - Date.now());`. Sonra mevcut `AbortSignal.timeout(...)` çağrılarının argümanını remaining()'e bağla: create (:74) `AbortSignal.timeout(remaining())`; poll döngüsü ayrı deadline'ını (:98) KALDIR → `while (remaining() > 0)`, poll fetch (:103) `AbortSignal.timeout(Math.min(15_000, remaining()))`; output fetch (:128) `AbortSignal.timeout(Math.min(60_000, remaining()))`; input fetch (:45) `Math.min(30_000, remaining())`.
> **Idempotency-Key / sourceKey / dedup EKLEME** (Replicate desteklemiyor; ayrı iş).

### `src/app/api/design/enhance/route.ts`
`export const maxDuration = 120;` ekle (runtime yanı). vercel.json'a gerek yok.

---

## M7 — kargo poll birleştirme (Migration 187 + paylaşılan fn + 4 route)
> Kök: 3 route'ta kopya poll mantığı → dedup kaybı (#1), cron↔override/bulk yarışı (#2/#3), bilinmeyen→"Yolda" (#4), parse sessiz bozulma (#5). **Adversaryal 3 düzeltme bake edildi.**

### M7a) `storefront/supabase/migrations/187_shipment_event_dedupe_key.sql` (YENİ)
Dedup anahtarına **assignment_id ekle** (yeniden-gönderim/şube event'leri ezilmesin). **'unknown'ı CHECK'e EKLEME.**
```sql
-- Mig 187: shipment event dedup key — assignment_id dahil (append-only). mig052 stili.
drop index if exists public.uniq_shipment_event_dedupe;
create unique index if not exists uniq_shipment_event_dedupe
  on public.shipment_status_events(order_id, assignment_id, status, event_time);
comment on index public.uniq_shipment_event_dedupe is
  'M7 FAZ4: dedup per (order_id, assignment_id, status, event_time) — append-only; şube/re-shipment event korunur.';
```
> Yeni index ESKİ'den daha **geniş** (daha çok kolon=daha az çarpışma) → mevcut veride 23505 vermez. assignment_id NULLABLE; Postgres NULL'ları DISTINCT sayar (istenen). **CHECK'e dokunma** ('unknown' eklenmez — aşağıya bak).

### M7b) `storefront/src/lib/shipping/persist-shipment-poll.ts` (YENİ — paylaşılan fn)
`persistShipmentPoll(admin, {assignmentId, orderId, trackingNumber, apiResult, sendMail})`:
1. Her event: `ev.status==='unknown'` ise **event satırını ATLA** (CHECK-güvenli); değilse `shipment_status_events` upsert `onConflict:'order_id,assignment_id,status,event_time', ignoreDuplicates:true`.
2. **`order_assignments`'tan `{tracking_status, tracking_delivered_at}`'i TAZE oku** (batch-snapshot DEĞİL — bu, delivered-ezme yarışını kapatan asıl şey).
3. `casUpdate(admin,'order_assignments',assignmentId,{tracking_status:apiResult.currentStatus, tracking_last_polled_at:now, tracking_delivered_at:apiResult.deliveredAt??null},{expectFrom:freshOldStatus,col:'tracking_status'})`. `{ok:false,reason:'stale'}` → `return {skipped:true}` (yarışı kaybetti, mail YOK).
4. `statusChanged = cas.ok && apiResult.currentStatus !== freshOldStatus`; `justDelivered = cas.ok && !freshWasDelivered && apiResult.deliveredAt`.
5. `sendMail && statusChanged && status ∈ {in_transit,failed,returned}` → `sendShipmentStatus` (fire-and-forget). justDelivered → yalnız log (FAZ 2 kararı: shipped maili ayrı). 
> **orders.status'a DOKUNMA** (o tracking route'un işi). Desen: casUpdate + mevcut cron poll-persist bloğu birleşik.

### M7c) 4 route — inline poll bloğunu paylaşılan fn'e çevir
- `cron/poll-shipments/route.ts` (~115-230) → `persistShipmentPoll(supabase,{...,sendMail:true})`. !success dalı (tracking_last_polled_at bump) kalsın. **İkinci advisory lock EKLEME** — withCronRun zaten `'cron:poll-shipments'` kilidini tutuyor.
- `admin/shipments/bulk-poll/route.ts` (~94-133) → aynı çağrı, `sendMail:true`. **Session advisory lock EKLEME** (PgBouncer'da güvenilmez); cron↔bulk karşılıklı dışlama **tracking_status CAS**'iyle (kaybeden stale döner, çift-yazma yok).
- `admin/orders/[id]/tracking/route.ts` (~205-235) → `persistShipmentPoll(...,sendMail:false)`. `transitionOrderStatus` (orders.status, :240) + ayrı `sendOrderShipped` (272-307) **DEĞİŞMEZ**.
- `admin/shipments/[orderId]/override/route.ts` → event upsert `onConflict:'order_id,assignment_id,status,event_time'` (yeni index'e hizala), `ignoreDuplicates:false` (admin kasıtlı) KALSIN. `tracking_delivered_at`'i AÇIKÇA set et: `status==='delivered' ? now : null` (#11 — eski delivered timestamp temizlensin). Override'ı persistShipmentPoll'dan GEÇİRME (kendi audit/reason'ı var).

### M7d) `storefront/src/lib/shipping/yurtici-api.ts` — unknown + parse (#4/#5)
- `NormalizedShipmentStatus` union'a `'unknown'` ekle; `normalizeYurticiStatus` boş (:105) ve eşleşmeyen default (:176) → `'unknown'` + `console.warn(ham metin)`. **Bilinmeyen→'Yolda' YAPMA.** (unknown event'i persist layer atlar; currentStatus 'unknown' olabilir → tracking_status='unknown', plain-text, izinli; sonraki cron'da yeniden poll edilir.)
- #5 parse: success'i `operationCode==0/00` (varsa) ile türet (events.length>0 değil) + 0-event'te ayrı `noData` flag; `extractTag`/`extractAllTags` namespace-toleranslı: `<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`; (opCode ok && 0 event) → `console.warn`; catch (:407) → `console.error`. fetchWithTimeout/20s YURTICI_HTTP_TIMEOUT_MS KALSIN (timeout'ta success:false → satır sonraki cron'da yeniden poll, akış kırılmaz).

---

## DİKKAT (adversaryal düzeltmeler)
- ❌ M16: idempotency-key/scale-dedup ekleme; search-engine-ping.ts'e dokunma; helper fonksiyonuna dokunma (yalnız name kontrolü).
- ❌ M7: shipment_status_events'e `status='unknown'` INSERT etme (CHECK patlar, TÜM event response kaybolur) → unknown event'i ATLA, yalnız tracking_status='unknown' set et.
- ❌ M7: yeni advisory lock ekleme (cron'da redundant, bulk'ta PgBouncer'da etkisiz) — CAS yeter.
- ❌ M7: oldStatus'u batch-snapshot'tan kullanma → CAS'ten HEMEN ÖNCE TAZE oku (delivered-ezme yarışı bu yüzden kapanır).
- ❌ M7: CHECK'e 'unknown' ekleme; tracking route'ta orders.status'u persistShipmentPoll'a verme.
- ❌ Push etme.

## Doğrulama (Claude)
- M16: verify-cursor-diff manifest (build + helper `TimeoutError` var + Instagram/SEO/GA4 fetchWithTimeout + image-upscale remaining()).
- M7: DB probe (mig 187 yeni index = (order_id,assignment_id,status,event_time)) + verify-cursor-diff (persistShipmentPoll var, 4 route çağırıyor, unknown-event-skip, oldStatus taze okuma, advisory-lock yok).

## Sıra
1. Cursor: M16 (helper ÖNCE) + M7 (mig 187 canlıya uygula → persistShipmentPoll → 4 route → yurtici). `npm run build`. 2 commit (push yok).
2. Claude: mig 187 canlı + verify-cursor-diff.
