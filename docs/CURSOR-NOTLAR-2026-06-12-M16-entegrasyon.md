# Cursor Notları — M16: Dış Entegrasyon Dayanıklılığı

> Hata-tespit (P3, cross-cutting). Boyut: D2 sözleşme, D3 hata, D4 idempotency. PayTR(M2)/R2(M11)/Resend(M12)/kargo(M7) kendi modüllerinde.
> **Genel:** Merkezi `fetchWithTimeout`/`external-timeouts.ts` altyapısı iyi ama **kapsama eksik** — en kritik bazı entegrasyonlar çıplak `fetch` ile timeout'suz. AI çağrıları büyük oranda doğru (timeout+Zod+çoğu fallback'li). Circuit breaker hiç yok.

## Timeout kapsama özeti
- ✅ **Timeout var:** Netgsm SMS (10s), Upstash (5s), TÜM OpenAI çağrıları (SDK abortSignal 30-90s + maxRetries + Zod), Replicate (120s), app-health smoke (15s).
- ❌ **Timeout YOK (çıplak fetch):** Instagram (fetch-media, token, sync — 3 çağrı), GSC (sitemap submit + performance), IndexNow, sitemap ping, GA4 Data API (SDK config yok), Google Auth token (GSC/GA4).

## 🟠 YÜKSEK

### 1. Instagram entegrasyonunun TAMAMI timeout'suz → ana sayfa render'ını bloklayabilir · D3
- **Konum:** `lib/instagram/fetch-media.ts:23`, `token.ts:111`, `sync-slots.ts:46` (üçü de çıplak `fetch`)
- **Sorun:** `getInstagramHomeFeed` ana sayfada server-side çağrılıyor. ISR cache MISS'te Instagram graph API yavaşsa istek askıda → Vercel fonksiyon timeout'una kadar render bloklanır. `try/catch` var ama timeout olmadığı için "hata" tetiklenmeden hang olur.
- **Düzeltme:** Üçünü `fetchWithTimeout` ile sar; `INSTAGRAM_HTTP_TIMEOUT_MS=8000`; timeout'ta boş dizi (slot fallback zaten var). (Doğrulama #1.)

### 2. Replicate upscale polling — sonsuza yakın bekleme + idempotent olmayan create · D3/D4
- **Konum:** `lib/design/image-upscale.ts:98-115` (poll), `:59-75` (create)
- **Sorun:** Poll fetch 15s ama döngü `deadline=now+120s`. Toplam (create 120s + poll 120s + indirme 60s) Vercel `maxDuration`'ı aşar → yarıda kesilince Replicate prediction yetim. `predictions` POST'unda idempotency key yok → retry'da **çift prediction = çift maliyet**.
- **Düzeltme:** Tek wall-clock `deadline` (~100s); design_file_id bazlı "zaten upscale edildi mi" dedup. (Doğrulama #3.)

### 3. GSC/IndexNow/sitemap ping timeout yok · D3
- **Konum:** `lib/seo/google-search-console.ts:77`, `gsc-performance.ts:83`, `indexnow.ts:70,102`, `search-engine-ping.ts:27,51`
- **Sorun:** Hepsi çıplak `fetch`. `seo-indexing` cron'u `Promise.all` ile çalıştırıyor; hedef askıda kalırsa cron 60s'te kesilir, gerçek hata gizli. (Google sitemap ping endpoint'i zaten kaldırılmış — ölü kod.)
- **Düzeltme:** `fetchWithTimeout` (`GSC_HTTP_TIMEOUT_MS=15000`, `INDEXNOW=10000`); ölü ping'i kaldır.

### 4. `google-auth-library` token + GA4 client timeout'suz · D3
- **Konum:** `google-search-console.ts:64-65`, `gsc-performance.ts:69-70`, `analytics/ga4-data-api.ts:201,308`
- **Sorun:** `getAccessToken()` ve `BetaAnalyticsDataClient.runReport` timeout config yok; gRPC default uzun. GA4 dashboard admin panelinde senkron → Google yavaşsa admin sayfası asılır. (try/catch var, çökmüyor ama hang.)
- **Düzeltme:** GA4 client'a deadline; GSC fetch timeout (#3); admin'de `Promise.race` timeout wrapper.

## 🟡 ORTA
- **5.** Netgsm SMS retry yok — transient hatada sessiz düşer; retry eklenirse idempotent değil → çift SMS tuzağı (`netgsm.ts:101-125`). → retry eklenecekse yalnız timeout/5xx + idempotency anahtarı. (SMS şu an bilinçli devre dışı — Doğrulama #4.) · D3/D4
- **6.** Dış API yanıt şeması `as` cast ile (Zod değil) — Netgsm, Upstash, GSC, Instagram. Upstash `data[0].result` beklenmedik şekilde `?? 1` ile rate-limit **pasifize** olur (her istek geçer — güvenlik/maliyet) (`rate-limit.ts:141`). → Upstash+Netgsm minimal Zod `safeParse`; Upstash parse hatasında in-memory fallback. · D2
- **7.** AI bütçe guard tutarsız: `classify-ticket`/`parse-search-intent` `isGlobalAiBudgetExceeded` kontrol ediyor ama `humanize-qc`/`daily-summary`/`design-qc`/`ai-validator`/`cutline-*` etmiyor → bütçe aşımında yine maliyet. · D3
- **8.** `design-qc.ts:363` ve `proof/ai-validator.ts:77-101` AI hatasında `throw` (diğerleri fallback) → ödeme sonrası background QC'de sipariş `proof_generating`'de takılabilir (app-health "stuck_proof_generating" yakalıyor ama otomatik fallback yok). → çağıran tarafta throw'u yakala, "uzman gözü" fallback. (Doğrulama #2.) · D3

## 🟢 DÜŞÜK
- **9.** `proof/ai-validator.ts:97` timeout hardcoded `45_000` (merkezi `OPENAI_VISION_TIMEOUT_MS` yerine). → import et. · D3
- **10.** App-health smoke tek deneme, retry/jitter yok → cold-start false-positive "endpoint_down" alarmı (`app-health.ts:104-117`). → 1 retry (2s backoff). · D3
- **11.** App-health R2 sentinel (S3 SDK) timeout config yok (`app-health.ts:361-410`). → `NodeHttpHandler` timeout. · D3
- **12.** Circuit breaker hiçbir entegrasyonda yok — sürekli 5xx'te her istek timeout süresince bekler → yüksek hacimde fonksiyon havuzu tükenmesi. → OpenAI için basit ardışık-hata sayacı + kısa devre. · D3 (bilgi)

## [KOZMETİK]
- `design-qc.ts:381` `.replace("jpeg","jpeg")` no-op.
- `image-upscale.ts:29-33` `pickScale` iki dal aynı `return 2`.
- `search-engine-ping.ts` Google ping endpoint kaldırıldı (her zaman 404) — ölü kod.

## ❓ Doğrulanacaklar
1. `getInstagramHomeFeed` server component render path'inde mi (request-blocking) — `HomeInstagram.tsx` (#1 ciddiyeti).
2. `runDesignQC`/`validateProofWithAI` çağıran proof-job throw'u yakalıyor mu (#8).
3. Replicate upscale retry'lı job kuyruğundan mı çağrılıyor (#2 çift-prediction gerçekliği).
4. `sendSms` canlıda gerçekten devre dışı mı (#5).
5. GA4/GSC kütüphane default timeout (gRPC sürüm bazlı) — admin hang riski.

**En kritik:** #1 (Instagram timeout'suz → ana sayfa hang) · #2 (Replicate çift-prediction + sınırsız bekleme) · #3+#4 (SEO/GSC/GA4/Google-Auth timeout'suz grup). Altyapı iyi, eksik kapsama sorunu.
