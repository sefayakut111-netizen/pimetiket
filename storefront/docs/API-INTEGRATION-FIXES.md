# API Entegrasyon Düzeltmeleri — İnceleme Kaydı

**Tarih:** 23 Mayıs 2026  
**Kaynak:** Mimari ve API Entegrasyon Analizi raporu (May 2026)  
**Durum:** Uygulandı — production deploy öncesi smoke test önerilir

---

## Özet

Dış API ve OpenAI entegrasyonlarında tespit edilen kritik dayanıklılık açıkları giderildi. Odak: **sipariş QC hattının paid'de takılmaması**, **HTTP timeout**, **circuit breaker fail-closed**, **OpenAI retry/timeout**, **cutline fallback tutarlılığı**.

---

## 1. Merkezi HTTP timeout altyapısı

| Dosya | Açıklama |
|-------|----------|
| `src/lib/http/external-timeouts.ts` | Tüm dış servis timeout sabitleri (ms) |
| `src/lib/http/fetch-with-timeout.ts` | `fetch` + `AbortSignal.timeout` sarmalayıcı |

### Sabitler

| Sabit | Değer | Kullanım |
|-------|-------|----------|
| `PAYTR_HTTP_TIMEOUT_MS` | 15_000 | PayTR get-token, iade, durum-sorgu |
| `NETGSM_HTTP_TIMEOUT_MS` | 10_000 | SMS gönderimi |
| `YURTICI_HTTP_TIMEOUT_MS` | 20_000 | Kargo SOAP sorgusu |
| `UPSTASH_HTTP_TIMEOUT_MS` | 5_000 | Rate limit Redis pipeline |
| `OPENAI_VISION_TIMEOUT_MS` | 45_000 | gpt-4o vision (QC, cutline fallback) |
| `OPENAI_CHAT_TIMEOUT_MS` | 90_000 | Pim chat streaming |
| `OPENAI_MINI_TIMEOUT_MS` | 30_000 | gpt-4o-mini cutline feedback |

---

## 2. Ödeme sonrası Design QC (`run-order-qc.ts`)

### Sorun (rapor)
- Fire-and-forget QC; üst seviye DB/throw → sipariş `paid`'de kalıyordu
- Paralel `verdictCounts` mutasyonu race condition riski

### Yapılanlar
- **`runOrderDesignQC` dış sarmalayıcı:** Beklenmeyen hatalarda `human_review` + `qc_pipeline_failure` order event + Sentry
- **Items/files sorgu hataları:** throw yerine `human_review` escalate (throw kaldırıldı)
- **Paralel QC sonuç toplama:** `Promise.allSettled` sonrası verdict sayımı (race-safe)

### Etkilenen akış
`payment/callback` → `void runOrderDesignQC(...)` — davranış aynı (await yok), fakat iç hata artık siparişi insan kuyruğuna alır.

---

## 3. AI circuit breaker (`circuit-breaker.ts`)

### Sorun (rapor)
DB sorgusu hata verince circuit **fail-open** (kapalı) → OpenAI kesintisinde gereksiz yük

### Yapılan
- DB hatasında circuit **fail-closed** (`open: true`) → AI atlanır, mevcut akış `human_review` fallback'ine düşer

---

## 4. OpenAI çağrıları

| Endpoint / modül | Değişiklik |
|------------------|------------|
| `design-qc.ts` | `maxRetries: 2`, `abortSignal` 45s |
| `api/pim/chat/route.ts` | `abortSignal` 90s; eksik key → **503** (500 yerine) |
| `cutline-vision-fallback/route.ts` | `maxRetries: 2`, `abortSignal` 45s |
| `cutline-feedback/route.ts` | `abortSignal` 30s |

---

## 5. Cutline vision fallback (`cutline-vision-fallback/route.ts`)

### Sorun (rapor)
429 / signed URL 500 → istemci sessiz fail; OpenAI hata yüzeyi tutarsız

### Yapılan
- Rate limit **auth sonrasına** taşındı (kind bilgisi ile fallback mümkün)
- Rate limit, signed URL hatası, OpenAI hatası → **200 + `fallback: true` + kural-tabanlı yanıt**
- `fallback_reason` alanı: `rate_limit` | `signed_url_failed` | `openai_error`

---

## 6. Dış HTTP entegrasyonları

| Modül | Değişiklik |
|-------|------------|
| `paytr.ts` | 3 fetch → `fetchWithTimeout`; timeout reason `timeout` |
| `netgsm.ts` | `fetchWithTimeout`; timeout → `error: "timeout"` |
| `yurtici-api.ts` | `fetchWithTimeout`; timeout mesajı ayrıştırıldı |
| `rate-limit.ts` | Upstash pipeline → 5s timeout |

---

## Bilinçli olarak yapılmayanlar (sonraki iterasyon)

| Konu | Gerekçe |
|------|---------|
| Pim chat route → ayrı servis katmanı | Büyük refactor; davranış değişikliği riski |
| PDF/vektör gerçek vision | Ürün kararı + pdf-lib render gerektirir |
| Upstash zorunlu kılma | Infra/env değişikliği |
| POC CDN self-host | Ayrı asset pipeline |
| Scanner `.env` repo dışına taşıma | Ops/güvenlik süreci |

---

## Smoke test checklist (deploy sonrası)

- [ ] Test ödeme → QC tetiklenir → `human_review` veya `proof_generating` (paid'de takılmaz)
- [ ] OpenAI key kapalıyken Pim chat → 503, uygulama ayakta
- [ ] Cutline vision fallback → rate limit veya AI hata → banner görünür (`fallback: true`)
- [ ] PayTR init → normal checkout; simüle yavaş yanıt → `timeout` reason
- [ ] Circuit breaker: son 10 dk'da çok `error` verdict → yeni sipariş `human_review` (AI atlanır)

---

## Değişen dosyalar (tam liste)

```
src/lib/http/external-timeouts.ts          (yeni)
src/lib/http/fetch-with-timeout.ts         (yeni)
src/lib/payment/paytr.ts
src/lib/sms/netgsm.ts
src/lib/shipping/yurtici-api.ts
src/lib/rate-limit.ts
src/lib/agents/circuit-breaker.ts
src/lib/agents/design-qc.ts
src/lib/agents/run-order-qc.ts
src/app/api/pim/chat/route.ts
src/app/api/pim/cutline-vision-fallback/route.ts
src/app/api/pim/cutline-feedback/route.ts
docs/API-INTEGRATION-FIXES.md              (bu dosya)
smart-context/manifest.json                (referans güncellendi)
.cursor/rules/integrations.mdc             (yeni — Cursor otomatik bağlam)
scripts/smart-context.mjs                  (alsoLoads + keyword fix)
docs/SISTEM-BAGIMLILIK-HARITASI.md         (§8 entegrasyon haritası)
```
