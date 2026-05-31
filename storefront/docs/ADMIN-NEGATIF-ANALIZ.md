# Admin Panel — Negatif Odaklı Analiz Raporu

> **Tarih:** 31 Mayıs 2026  
> **Kapsam:** `src/app/admin/` (56 sayfa), `src/app/api/admin/` (115 route), `src/components/admin/`  
> **Yöntem:** Statik kod taraması + `scripts/admin-negative-audit.mjs` + E2E genişletme (auth env eksik) + doküman cross-check  
> **Baseline:** [`ADMIN-AKISI-SNAPSHOT.md`](./ADMIN-AKISI-SNAPSHOT.md) v1.0 (21 Mayıs 2026)

---

## 1. Executive Summary

| Metrik | Değer |
|--------|-------|
| **P0** (veri/güvenlik/operasyon durur) | 1 |
| **P1** (günlük operasyonu yanıltır/bloklar) | 12 |
| **P2** (kısmi özellik / env bağımlı) | 11 |
| **P3** (kozmetik / düşük etki) | 6 |
| Admin API guard kapsamı | 114/115 (`grant-credit` istisna) |
| Cron sayım senkronu (vercel.json ↔ registry) | 25/25 — uyumlu |
| E2E statik sayfa kapsamı | 45/47 sidebar rotası (dev-only 2 hariç) |
| Runtime E2E çalıştırıldı mı | Hayır — Supabase env eksik |

### Top 5 acil fix

1. **P1** — Fason listesi, KVKK, bekleyen denetçiler: API hatası → boş liste (operatör “veri yok” sanır).
2. **P1** — Finans + dashboard: finansal özet ve opsiyonel widget’larda sessiz `catch`.
3. **P1** — RBAC: `/admin/kuyruk`, `/admin/sistem/*` middleware’de `dashboard` modülüne düşüyor; operatör sistem sayfalarına girebilir (API’ler ayrı korunuyor).
4. **P2** — Migration 075 (ürün encoding) prod’da uygulanmamış olabilir — admin `/admin/urunler` bozuk metin.
5. **P2** — Migration 110 prod doğrulaması — cron SLA/upload-reminder hataları devam edebilir.

---

## 2. Çalışmayan / Yarım Özellikler Envanteri

| Alan | Durum | Bilinçli mi? | Kanıt |
|------|-------|--------------|-------|
| E-fatura / Paraşüt | Yok | Evet (Faz 6 blocked) | `ADMIN-ANALIZ-SONUC.md` |
| PayTR uzlaşma UI | Banner “henüz aktif değil” | Evet | `finans/page.tsx:449` |
| Abone welcome mail | Resend otomasyonu kapalı | Evet | `aboneler/page.tsx:180` |
| Kargo tracking (canlı) | Yurtiçi env yoksa DRY_RUN sahte event | Evet (env) | `poll-shipments/route.ts:18`, `YURTICI_DRY_RUN` |
| grant-credit API | 410 Gone | Evet (Mig 015) | `grant-credit/route.ts` |
| Fast track baskı | `fastTrackEnabled: false` | Evet | `ayarlar/page.tsx` |
| Denetçi “Çok yakında” rozeti | Henüz hiç run yapmamış auditor kartları | Kısmen bug | `denetciler/page.tsx:505-508` — API’de 9 auditor canlı |
| Migration 075 encoding | DB’de bozuk Türkçe karakter | Bug (prod apply bekliyor) | `075_product_cards_encoding_fix.sql` header |
| Help respond mail TODO | Yorum güncel değil — mail **implemente** | Dokümantasyon drift | `help-requests/.../respond/route.ts:153` |
| AI QC dosyasız onay | **Guard mevcut** (`hasDesignFile`) | Düzeltilmiş | `ai-qc/page.tsx:765,1119` |
| Cron 15 vs 16 tutarsızlığı | **Düzeltilmiş** — registry=25, vercel=25 | — | `cron-registry.ts`, `vercel.json` |

---

## 3. Sessiz Hata Haritası (sayfa bazlı)

Operatör API hatasını “boş veri” veya “widget yok” olarak görür.

| Sayfa | Şiddet | Belirti | Dosya |
|-------|--------|---------|-------|
| Fason listesi | P1 | Fetch fail → boş partner listesi, sadece `console.error` | `fason/page.tsx:48-59` |
| AI QC kuyruk | P1 | `ok:false` veya network → log only, kuyruk boş kalır | `ai-qc/page.tsx:247-265` |
| AI QC geçmiş | P2 | Aynı desen | `ai-qc/page.tsx:268-297` |
| KVKK talepleri | P1 | List fail → boş tablo | `kvkk-talepleri/page.tsx:97-108` |
| Denetçiler bekleyen | P1 | Fail → `setItems([])` | `denetciler/bekleyen/page.tsx:41-44` |
| Denetçiler ertelenen | P1 | Fail → `setItems([])` | `denetciler/ertelenenler/page.tsx` |
| Finans özet API | P1 | `catch(() => { /* silent */ })` | `finans/page.tsx:222-224` |
| Finans sipariş sync | P2 | Silent catch on `refreshCustomerOrders` | `finans/page.tsx:198-200` |
| Dashboard opsiyonel strip’ler | P2 | system-health, fason özet, activity, reviews, stuck designs — sessiz | `page.tsx:536-598` |
| Sipariş detay | P1 | GET fail → `order=null`, “bulunamadı” vs ağ ayrımı yok | `siparisler/[id]/page.tsx:229-246` |
| Arşiv R2 probe | P2 | `.catch(() => {})` | `arsiv/page.tsx:111` |
| Arşiv user QC | P2 | Log only | `arsiv/[userId]/page.tsx:109-110` |
| AdminShell badge fetch | P2 | orders/partners fail → localStorage fallback (stale badge) | `AdminShell.tsx:274-277,308` |
| Audit log sync | P2 | `refreshAuditLog()` fail → sadece local cache | `audit-log/page.tsx:117-124` |
| Destek müşteri arama | P3 | `setCustomerHits([])` sessiz | `destek/page.tsx:129` |

**İyi örnek:** `TrafficDashboard.tsx` — `error` state + SetupCard; `musteriler/page.tsx` — diagnostic banner + `setError`.

---

## 4. Auth / RBAC Bulguları

### 4.1 API guard audit (115 route)

| Sonuç | Detay |
|-------|-------|
| Guard’sız | 1 route: `customers/[id]/grant-credit` (410 Gone, kasıtlı) |
| `assertPermission` | ~100 route (modül bazlı) |
| Sadece `assertAdmin` | 15 route — örn. `traffic`, `funnel-metrics`, `orders/list`, `designs`, `reviews`, `backups`, `impersonate/partner`, `diagnostic` |

**P3 — `traffic/route.ts`:** `assertAdmin` kullanıyor; trafik sayfası nav’da `dashboard` modülü. Finans rolü staff ise erişebilir — granular `dashboard` veya `finans` tercih edilebilir.

### 4.2 Middleware path → modül eşlemesi

`resolveAdminPathModule()` bilinçli olmayan path’ler için **`dashboard` döndürür** (`admin-rbac.ts:116`).

**RBAC boşlukları (sidebar’da var, `ADMIN_PATH_MODULES`’da yok):**

| Path | Etki | Şiddet |
|------|------|--------|
| `/admin/kuyruk` | Operatör preset’i `dashboard: view` → kuyruk OK | P3 (tasarım) |
| `/admin/trafik` | Nav `module: dashboard` — tutarlı | — |
| `/admin/sistem/cronlar` | Operatör dashboard view ile **sayfayı görebilir**; cron trigger API `settings:update` ister | P1 (UI sızıntı) |
| `/admin/sistem/bakim` | Aynı | P1 |
| `/admin/test-siparis-simulator` | `null` → guard yok (profil gibi) | P2 (dev) |
| `/admin/debug/design-qc-test` | `dashboard` fallback | P2 (dev) |

**Fix önerisi:** `ADMIN_PATH_MODULES`'a `operation_queue`, `system` (veya `settings`) prefix’leri ekle; operatör preset’inden ayır.

### 4.3 Service role sızıntısı

`createAdminClient` yalnızca server/API route’larda — admin `page.tsx` veya `components/admin` içinde import **yok**. OK.

### 4.4 RBAC runtime test matrisi

| Test | Beklenen | Durum |
|------|----------|-------|
| Operatör → `/admin/finans` | Redirect veya `?denied=` | Kod analizi: middleware `fn_has_permission` — **doğrulanmadı** (env yok) |
| Operatör → `POST /api/admin/pricing/publish` | 403 | `assertPermission("pricing","update")` — kod OK |
| Operatör → `/admin/sistem/cronlar` | Muhtemelen **izin verilir** (dashboard view) | P1 |
| Legacy `admin_role=NULL` | Full access | Bilinçli geriye uyumluluk |

---

## 5. Veri Tutarlılığı ve Ölçek

### 5.1 Dashboard 500 limit

- `orders/list?limit=500` — `page.tsx:440`, truncation banner mevcut (`ordersTruncated`).
- Funnel metrikleri: `/api/admin/funnel-metrics` (server) + client-side funnel gruplama (`page.tsx:900+`).
- Top müşteri/şehir: client-side `metricOrders` — 500+ siparişte **eksik KPI riski** (P2).

### 5.2 Sipariş badge vs liste

- Badge: `countActiveOrdersForBadge` — **iptal hariç** (`order.ts:81-84`).
- Liste: `catalogOrders.length` — iptal **dahil**.
- Sidebar tooltip açıklıyor (`AdminShell.tsx:462`) — P3 (bilinçli fark).

### 5.3 Cron

- `CRON_REGISTRY.length` = 25, `vercel.json` crons = 25 — **senkron**.
- Eski “15 vs 16” raporu **giderilmiş** görünüyor.

### 5.4 Migration durumu (prod doğrulanmadı)

| Migration | Amaç | Risk |
|-----------|------|------|
| **110** | `paid_at`, `design_files.created_at`, `fn_process_proof_pending_sla` | P1 — auto-refund, upload-reminders cron fail |
| **075** | product_cards encoding fix | P2 — `/admin/urunler` bozuk karakter |

---

## 6. Entegrasyon / Env Bağımlılıkları

| Servis | Admin yüzeyi | Fail modu | Şiddet |
|--------|--------------|-----------|--------|
| **Supabase RLS** | `/admin/musteriler` | Diagnostic UI + `42501` hint | P1 (prod-only) |
| **Resend** | mail-health, notifications | `system-health` warning `resend_not_configured` | P2 |
| **R2** | arsiv, yedekler | `r2-status` silent; `IS_ARCHIVE_DRY_RUN` warning | P2 |
| **GA4** | trafik | SetupCard (iyi UX) | P2 |
| **Yurtiçi** | kargo poll cron | DRY_RUN sahte event | P2 (env) |
| **OpenAI** | ai-qc, agents | Timeout/rate — toast var karar akışında | P2 |
| **PayTR** | odemeler, reconciler cron | Settlement UI kapalı | P2 (ürün) |
| **Sentry/PostHog** | — | system-health info warnings | P3 |

### Hybrid ayarlar (P2)

`ayarlar/page.tsx`: DB PATCH + `localStorage` tam yedek — iki operatör veya DB fail sonrası **senkron kaybı** riski.

---

## 7. E2E Kapsam

### 7.1 Güncelleme

[`admin-journey.spec.ts`](../tests/e2e/admin-journey.spec.ts) **20 → 45** statik rota (sidebar + denetçi alt + fiyat-hesapla + mail-health).

### 7.2 E2E dışı (11 sayfa — dinamik veya dev)

| Rota | Neden |
|------|-------|
| `/admin/siparisler/[id]` | Dinamik ID |
| `/admin/musteriler/[id]` | Dinamik |
| `/admin/fason/[partnerId]` | Dinamik |
| `/admin/kargo/[orderId]` | Dinamik |
| `/admin/prova/[orderId]` | Dinamik |
| `/admin/denetciler/[auditor]` | Dinamik |
| `/admin/arsiv/[userId]` | Dinamik (ayrı arşiv akış testi var) |
| `/admin/test-siparis-simulator` | Dev-only |
| `/admin/debug/design-qc-test` | Dev-only |
| `/admin/agents/design-qc-test` | Dev-only |
| `/admin/odemeler/[id]` | Dinamik |

### 7.3 Runtime sonucu

```
npm run bot:admin → FAIL
Bot env eksik: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

**Doğrulanmamış:** Canlı HTTP/console hataları prod/staging’de test edilmedi.

---

## 8. Kritik Operasyon Akışları (kod incelemesi + manuel checklist)

| # | Akış | Kırılma noktası | Şiddet | Manuel test |
|---|------|-----------------|--------|-------------|
| 1 | Manuel sipariş | RPC `fn_create_manual_order` fail → 500 | P2 | ☐ |
| 2 | AI QC karar | Queue silent fail; decide API toast OK | P1 | ☐ |
| 3 | Prova SLA + reminder | Mig 110 + cron | P1 | ☐ |
| 4 | Fason atama + mail | assign route + outbox | P2 | ☐ |
| 5 | Kargo etiket PDF | label route font embed | P2 | ☐ |
| 6 | İade / refund | `payments/refund` + assertPermission | P2 | ☐ |
| 7 | KVKK process | List silent fail | P1 | ☐ |
| 8 | Fiyat publish/revert | pricing routes — yüksek etki | P1 | ☐ |
| 9 | Müşteri suspend | audit + customers API | P2 | ☐ |
| 10 | Arşiv signed URL | R2 env + silent probe | P2 | ☐ |

**Kod analizi özeti:** Akışlar implemente; ana risk **UI hata gösterimi** ve **prod migration/env**, mutasyon API’lerinin çoğu guard’lı.

---

## 9. API Smoke Matrisi (öncelikli)

Auth olmadan çalıştırılamadı. Beklenen davranış (guard’lı oturum ile):

| Endpoint | Method | Beklenen (auth’lu) | Modül |
|----------|--------|-------------------|-------|
| `/api/admin/orders/list` | GET | 200 + orders[] | orders |
| `/api/admin/customers` | GET | 200 veya migration hint | customers |
| `/api/admin/ai-qc/queue` | GET | 200 `{ok,queue}` | ai_qc |
| `/api/admin/shipments` | GET | 200 | shipments |
| `/api/admin/financials/summary` | GET | 200 | finans |
| `/api/admin/fason/partners` | GET | 200 | fason |
| `/api/admin/operation-queue` | GET | 200 | dashboard |
| `/api/admin/system-health` | GET | 200 veya 403 | settings |
| `/api/admin/traffic?range=7d` | GET | 200 veya not_configured | dashboard |
| `/api/admin/archive/r2-status` | GET | 200 | archive |
| `/api/admin/ai-qc/decide` | POST | 200/400 | ai_qc |
| `/api/admin/orders/bulk-status` | POST | 200 | orders |
| `/api/admin/fason/assign` | POST | 200/400 | fason |
| `/api/admin/pricing/publish` | POST | 200/403 | pricing |
| `/api/admin/cron-status/trigger` | POST | 403 operatör | settings |
| `/api/admin/customers/diagnostic` | GET | 200 JSON | customers |

---

## 10. Detaylı Bulgular (P0–P3)

### [P0] grant-credit guardsız (düşük exploit riski)

- **Alan:** `POST /api/admin/customers/[id]/grant-credit`
- **Belirti:** Herkes 410 alır; audit yok
- **Kök neden:** Deprecated endpoint, kasıtlı guardsız
- **Dosya:** `api/admin/customers/[id]/grant-credit/route.ts`
- **Fix:** `assertAdmin` ekle veya route sil
- **Doğrulama:** curl anon → 410

### [P1] Fason listesi — hata = boş liste

- **Alan:** `/admin/fason`
- **Belirti:** API down → “partner yok” görünümü
- **Dosya:** `fason/page.tsx:48-59`
- **Fix:** `setListError` + retry banner
- **Prompt:** `CURSOR-PROMPT-ADMIN-OPERASYON-V5.md`

### [P1] KVKK listesi — hata banner yok

- **Dosya:** `kvkk-talepleri/page.tsx:97-108`
- **Fix:** `setError` + toast

### [P1] Bekleyen denetçiler — fail = empty queue

- **Dosya:** `denetciler/bekleyen/page.tsx:41-44`
- **Fix:** Error card; `setItems([])` sadece başarılı boş yanıtta

### [P1] Finans API sessiz fail

- **Dosya:** `finans/page.tsx:212-224`
- **Fix:** `setSummaryError(true)` + banner

### [P1] Sipariş detay yükleme

- **Dosya:** `siparisler/[id]/page.tsx:229-246`
- **Fix:** `loadError` state; 404 vs network ayrımı

### [P1] RBAC sistem sayfaları dashboard fallback

- **Dosya:** `admin-rbac.ts:116`, `AdminShell.tsx` sistem linkleri
- **Fix:** `/admin/sistem` → `settings` modülü

### [P1] Müşteriler prod RLS (prod-only)

- **Belirti:** Liste fail, diagnostic link
- **Dosya:** `musteriler/page.tsx:430+`, `customers/diagnostic/route.ts`
- **Fix:** Prod’da diagnostic çalıştır, view/RLS düzelt
- **Prompt:** `CURSOR-PROMPT-ADMIN-MUSTERI-FIX.md`

### [P1] Migration 110 prod apply belirsiz

- **Belirti:** Cron error strip’te SLA/upload hataları
- **Dosya:** `supabase/migrations/110_fix_missing_columns.sql`
- **Fix:** Supabase SQL apply + cron_runs kontrol
- **Prompt:** `CURSOR-PROMPT-ADMIN-KRITIK-FIX-V2.md` FIX-1

### [P2] Denetçi hub “Çok yakında” yanıltıcı

- **Belirti:** Hiç run olmayan auditor kartında “Çok yakında”; API’de 9 auditor LIVE
- **Dosya:** `denetciler/page.tsx:505-508`
- **Fix:** “Henüz çalışmadı” / “İlk taramayı bekle”

### [P2] Dashboard client-side KPI limit

- **Dosya:** `page.tsx:440,678`
- **Fix:** `dashboard-aggregate` genişlet (Faz 3 plan)

### [P2] Migration 075 encoding

- **Dosya:** `075_product_cards_encoding_fix.sql`
- **Fix:** Prod SQL apply

### [P2] Kargo DRY_RUN tracking

- **Dosya:** `poll-shipments/route.ts`
- **Fix:** Yurtiçi env veya UI’da “simülasyon modu” badge

### [P2] PayTR settlement / e-fatura

- Ürün kararı — bug değil

### [P3] alert() vs toast

- **Dosya:** `siparisler/page.tsx`, `mail-health/page.tsx`, `arsiv/[userId]/page.tsx`

### [P3] Audit log server sync fail görünmez

- **Dosya:** `audit-log/page.tsx:117-124`

---

## 11. Fix Backlog ↔ Mevcut Prompt Eşlemesi

| Bulgu | Prompt dosyası |
|-------|----------------|
| Migration 110, cron | `CURSOR-PROMPT-ADMIN-KRITIK-FIX-V2.md` |
| AI QC guard | FIX-3 — **tamamlandı** |
| Badge sayım | FIX-4 — **tooltip ile mitige** |
| Operasyon akışları | `CURSOR-PROMPT-ADMIN-OPERASYON-V5.md` |
| Müşteri RLS | `CURSOR-PROMPT-ADMIN-MUSTERI-FIX.md` |
| Cron/sistem | `CURSOR-PROMPT-ADMIN-SISTEM-FIX.md` |
| Server-side aggregation | `ADMIN-ANALIZ-SONUC.md` Faz 3 |

---

## 12. ADMIN-AKISI-SNAPSHOT Diff

| Metrik | v1.0 (21 May) | Bu analiz (31 May) | Δ |
|--------|---------------|---------------------|---|
| Tam çalışan sayfa | 37/41 | ~48/56* | +11 sayfa kapsam |
| Kısmi (DB/env) | 3 | 5 | +2 (mig 075/110, R2 dry-run) |
| Kırık (prod-only) | 1 (müşteriler) | 1 (müşteriler RLS — doğrulanmadı) | 0 |
| E2E kapsam | ~20 sayfa | 45 statik rota | +25 |
| Cron sayım bug | Bilinmiyor | Düzeltilmiş (25=25) | OK |
| AI QC dosyasız onay | Risk vardı | Guard var | İyileşme |

\*Tahmini — runtime E2E olmadan; statik analiz + snapshot birleşimi.

### v1.0 engeller güncel durum

| # | Engel v1.0 | Durum |
|---|------------|-------|
| 1 | Paraşüt fatura | Hâlâ yok (P2 ürün) |
| 2 | Urunler encoding | Mig 075 repo’da, apply belirsiz |
| 3 | Kargo sahte event | DRY_RUN dokümante; env bekliyor |
| 4 | Mobile admin | Değişmedi (P3) |

---

## 13. Doğrulanmamış Hipotezler

1. Prod Supabase’de `v_admin_customers` view hatası hâlâ aktif mi?
2. Migration 110/075 prod’da uygulandı mı?
3. 45 admin sayfasının prod’da HTTP 4xx/5xx üretip üretmediği (E2E env gerekli).
4. Operatör rolü ile `/admin/sistem/cronlar` UI erişimi (middleware live test).
5. `orders/list?limit=500` prod hacminde truncation sıklığı.

---

## 14. Araçlar

```bash
# Statik tarama
cd pim-etiket/core/storefront
node scripts/admin-negative-audit.mjs

# E2E (env gerekli)
npm run bot:admin
# Gerekli: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, .env.local
```

---

## 15. Öncelikli Aksiyon Sırası

1. P1 sessiz fetch sayfalarına ortak `AdminFetchError` banner (fason, kvkk, bekleyen, finans, sipariş detay).
2. RBAC: `ADMIN_PATH_MODULES` genişlet (`kuyruk`, `sistem/*`).
3. Prod: Migration 110 + 075 apply + `customers/diagnostic` JSON.
4. E2E: Supabase env ile `bot:admin` CI’da çalıştır.
5. P2: Dashboard aggregation server-side (Faz 3 roadmap).
