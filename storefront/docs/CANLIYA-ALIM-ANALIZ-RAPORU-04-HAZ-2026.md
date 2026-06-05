# Pim Etiket — Canlıya Alım Öncesi Kapsamlı Analiz Raporu

**Tarih:** 4 Haziran 2026  
**Kapsam:** `pim-etiket/core/storefront` · Production: `https://pimetiket.com`  
**Yöntem:** Kod tabanı statik analizi + canlı ortam HTTP/API doğrulaması + yerel regression scriptleri  
**Commit (canlı):** `130df4b` (`GET /api/health`)

> Bu rapor yalnızca durum tespiti içerir; kod veya altyapı değişikliği yapılmamıştır.

---

## Yönetici Özeti

| Alan | Kod hazırlığı | Canlı doğrulama | Risk |
|------|---------------|-----------------|------|
| Teknik altyapı | Güçlü | Kısmen doğrulandı | Orta |
| Performans | Orta–İyi | Kısmen (TTFB iyi; Lighthouse API limiti) | Orta |
| UX/UI | İyi (sticker odaklı) | Kod + canlı HTML | Orta |
| SEO | Güçlü | Doğrulandı (GSC meta, sitemap, robots) | Düşük–Orta |
| Analitik | Güçlü | **Tüm env flag'leri true** | Düşük |
| Güvenlik/Uyumluluk | Güçlü | Yasal sayfalar 200 | Düşük |
| Marka/İçerik | İyi | Canlı HTML doğrulandı | Düşük–Orta |

**Kritik iş kuralı:** `ETIKET_ENABLED = false` — Etiket siparişi **29 Haziran 2026**'ya kadar kapalı. Canlı dönüşüm yolu **sticker** üzerinden.

**En acil bulgular (P0):**
1. ~~`www.pimetiket.com` apex'e yönlendirilmiyor~~ → **✅ ÇÖZÜLDÜ** (commit `03f0c21`, 4 Haz, next.config.ts host-based 308)
2. ~~Sepet WhatsApp CTA `905330000000` placeholder~~ → **✅ ÇÖZÜLDÜ** (commit `608fc9d`, 4 Haz, gerçek numara `905456999063`)
3. ~~Destek talebi oluşunca e-posta bildirimi yok~~ → **✅ ÇÖZÜLDÜ** (commit `e52e604` + migration `153`, 4 Haz, admin + müşteri mail; outbox + Resend doğrulandı)
4. ~~PageSpeed/Lighthouse tam CWV ölçümü tamamlanamadı~~ → **✅ ÖLÇÜLDÜ** (4 Haz 20:05-20:10, Sefa manuel PSI mobile): Skorlar 73-82, ortak sorun **LCP 4.4-5.6s 🔴 (hepsi kırmızı)** — launch blocker değil ama hızlı kazanç paketi (PERF-1+2+A1) ile düzeltilmeli

---

## Doğrulama Özeti (Todo Matrisi)

| # | Kontrol | Sonuç | Detay |
|---|---------|-------|-------|
| 1 | SSL/HTTPS/DNS | ✅ Geçti | HTTP→HTTPS ✓; HSTS ✓; www→apex 308 ✓ (commit `03f0c21`) |
| 2 | Formlar & mail | ✅ Geçti | Health: mail=true; destek mail eklendi (commit `e52e604` + mig `153`) |
| 3 | Fiyat algoritması | ✅ Geçti | Regression + pricebook script OK |
| 4 | Core Web Vitals | ⚠️ Eksik | PSI API 429; TTFB ~0.28–0.35s |
| 5 | Analitik & SEO | ✅ Geçti | `/api/health` tüm flag'ler true; GSC meta canlıda |
| 6 | UX blokörler | ⚠️ Kısmen | WhatsApp ✅ (commit `608fc9d`); FAB+sticky çakışma riski manuel QA bekliyor |
| 7 | Yedekleme | ⚠️ Kısmen | R2 workflow + admin UI var; GO-LIVE'da adım yok |

---

## 1. Teknik ve Altyapı Analizi (Technical Audit)

### 1.1 SSL Sertifikası ve HTTPS

**Canlı doğrulama (4 Haziran 2026):**

| Test | Beklenen | Gözlem |
|------|----------|--------|
| `http://pimetiket.com` | 301/308 → HTTPS | **308 Permanent Redirect** → `https://pimetiket.com/` ✓ |
| `https://pimetiket.com` | 200 + HSTS | **200 OK** + `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` ✓ |
| `http://www.pimetiket.com` | HTTPS + canonical | **308** → `https://www.pimetiket.com/` ✓ (HTTPS'e) |
| `https://www.pimetiket.com` | Apex'e yönlendirme | **308** → `https://pimetiket.com/` ✓ (commit `03f0c21`, doğrulandı 4 Haz 16:28) |
| CSP | upgrade-insecure-requests | Response header'da mevcut ✓ |
| Sunucu | Vercel fra1 | `X-Vercel-Id: fra1::...` ✓ |

**Kod durumu:**

| Kontrol | Durum | Dosya |
|---------|-------|-------|
| Production HSTS | Uygulanmış | `next.config.ts` |
| CSP upgrade-insecure-requests | Uygulanmış | `next.config.ts` |
| Canonical URL | Tanımlı | `src/lib/site-url.ts` |
| HTTP→HTTPS (uygulama middleware) | Yok | `src/middleware.ts` — Vercel katmanında çözülüyor |
| www ↔ apex redirect | ✅ **Kodda var** (`next.config.ts` redirects() host-based 308) | commit `03f0c21`, 4 Haz |

**Değerlendirme:** HTTPS zorlaması ve HSTS production'da aktif. www → apex 308 redirect **çözüldü** (commit `03f0c21`, Next.js `redirects()` içinde host-based kural). Curl ile doğrulandı: `www.pimetiket.com/*` → `pimetiket.com/*` 308 + `Location` header doğru.

---

### 1.2 Form ve Entegrasyon Testleri

**Canlı `/api/health`:**

```json
{
  "ok": true,
  "version": "130df4b",
  "sentry": true,
  "analytics": true,
  "googleSearchConsole": true,
  "ga4": true,
  "posthog": true,
  "mail": true
}
```

**Kanal envanteri:**

| Kanal | UI | Backend | E-posta bildirimi | Canlı HTTP |
|-------|-----|---------|-------------------|------------|
| `/iletisim` | Pim chat + mailto + `/destek` | Form POST yok | Manuel | 200 |
| `/destek` | Destek formu | `POST /api/support/create` → Supabase | **Yok** | 200 |
| Footer newsletter | Abonelik | `POST /api/lead/subscribe` + outbox | Resend (cron) | — |
| Pim Chat | AI asistan | OpenAI | Yok | Global FAB |
| Sticker sipariş | Konfigüratör → sepet → ödeme | PayTR + orders | Transactional mail | 200 |

**Destek API (`/api/support/create`):** ~~Ticket insert sonrası yalnızca `{ ok: true, id }` döner; `enqueueMail` veya admin bildirimi **çağrılmıyor**.~~ **✅ ÇÖZÜLDÜ (4 Haz, commit `e52e604` + migration `153`):** Insert sonrası `admin_new_support_ticket` (ADMIN_NOTIFICATION_EMAIL listesine) + `customer_support_ticket_received` (kullanıcı/guest email'e) enqueue ediliyor. Idempotency: `support_new:{id}:{email}` / `support_received:{id}`. Migration 153 outbox `target_type` constraint'ine `'ticket'` ekledi. Canlı POST testi `9e565cf9-...` ticket için 2 outbox satırı → Resend `sent`.

**⚠️ Bilinen küçük açık (P2):** Admin mailindeki CTA `${SITE_URL}/admin/destek/{ticket_id}` — `/admin/destek` listing var ama dinamik `[ticket_id]` route henüz yok; admin tıklayınca listing'e iniyor, ticket'ı orada manuel buluyor. Ayrı iyileştirme (`P2 #19`).

**PayTR durumu:**
- CSP `frame-src` ve `connect-src` içinde `https://www.paytr.com` — canlıda PayTR iframe hazırlığı var
- `src/lib/payment/paytr.ts`: `isPayTrConfigured()` env trio kontrolü
- `src/app/odeme/page.tsx`: PayTR yoksa `/odeme-sonuc?status=fail&reason=psp_unavailable`
- `src/instrumentation.ts`: Production'da `PAYTR_TEST_MODE !== "0"` uyarısı
- **Canlı ödeme akışı bu raporda transaction test edilmedi** (auth + sepet gerekli)

**E-posta riskleri (kod):**
- ~~Sepet toplu sipariş: `wa.me/905330000000`~~ → ✅ ÇÖZÜLDÜ (commit `608fc9d`, gerçek numara `905456999063`)
- ~~E-posta alias tutarsızlığı~~ → **✅ ÇÖZÜLDÜ** commit `1beaf4e` — Sefa kararı (4 Haz): tek mailbox `info@pimetiket.com`. 4 dosya, 17 yer konsolide; alias'lar (`destek@`, `legal@`, `partnerlik@`) ileride mailbox açılırsa geri ayrıştırılabilir.
- Resend stub: env yoksa outbox pending (canlıda `mail: true` — env mevcut)

---

### 1.3 Dinamik Fiyat / Hesaplama Algoritmaları

**Yerel test sonuçları (4 Haziran 2026):**

| Script | Sonuç |
|--------|-------|
| `npx tsx scripts/payment-validation-kartli-regression.runner.ts` | **OK** — kartlı 75×75 config total: **556,85 ₺** |
| `npm run verify:pricebook` | **OK** — 6×6 @ 4000 adet => 0,3150 TL/adet; min qty 1000 kuralı |

**Mimari:**

| Bileşen | Dosya | Rol |
|---------|-------|-----|
| Pricing engine | `src/lib/pricing-engine/` | Geometri + maliyet |
| Sticker fiyat | `src/lib/sticker-customer-pricing.ts` | Müşteri fiyatı |
| Checkout doğrulama | `src/lib/payment-validation.ts` | Sunucuda yeniden hesap, %2 tolerans |
| Büyük etiket | `bigEtiketRedirect` (W>400 veya H>650 mm) | UI yönlendirmesi |

**Uç senaryo davranışları (kod):**
- Geometri yok: "uygun tabaka düzeni bulunamadı"
- Recalc fail: sanity floor (`unit ≥ 0.40 TL`, alan ≥ 100 mm²) — geçici risk
- Etiket sepet enjeksiyonu: validation path hâlâ mevcut
- Dedicated load/stress test: **repoda yok**

**Canlı admin `live_config` ↔ UI eşleşmesi (4 Haz, Claude doğrulaması):**

`scripts/inspect-pricing-config.mjs` (canlı DB query) + public pricebook endpoint + `/sticker` HTML inceleme sonucu:

| Scope | Live materials | Draft = Live? | Müşteri UI | Sonuç |
|---|---|---|---|---|
| **sticker** | `vinil, transparan, holo, simli` | ✅ Eşit | URL'de `material=holo/simli/transparan` görünüyor | ✅ EŞLEŞİYOR |
| **etiket_rulo** | `kraft, kuse, beyaz, ultra, metalik, seffaf` | ⚠️ Draft sırası farklı (`kuse` ilk) | Etiket KAPALI (`ETIKET_ENABLED=false`) | 🟡 Kritik değil — 29 Haz açılışta Publish basılmalı |
| **etiket_tabaka** | `kuse, kraft, beyaz` | ✅ Eşit | — | ✅ Temiz |

Sticker cut_multipliers `{diecut: 1.1, kisscut: 1.0, tabaka: 1.0}` — memory [[project-sticker-urunler]] 3 Haz değerleriyle bire bir. Public pricebook endpoint 200 dönüyor, frontend snapshot okuyor. Aktif satış ürünü olan sticker tarafında **admin → live → UI** zincirinde sapma yok.

---

### 1.4 Kırık Link Kontrolü ve 404

**Canlı HTTP durum kodları:**

| URL | Kod |
|-----|-----|
| `/` | 200 |
| `/sticker` | 200 |
| `/sticker/yapilandir` | 200 |
| `/etiket` | 200 |
| `/iletisim` | 200 |
| `/destek` | 200 |
| `/terim-sozlugu` | 200 |
| `/this-does-not-exist` | **404** |

**Kod altyapısı:**

| Öğe | Durum |
|-----|-------|
| Özel 404 | `src/app/not-found.tsx` — markalı |
| Runtime hatalar | `error.tsx`, `global-error.tsx` (Sentry) |
| Legacy redirect | `/iade-cayma` → `/iade-degisim-politikasi` (301) |
| E2E smoke | `tests/e2e/customer-journey.spec.ts` |

**Boşluklar:**
- Sitewide link crawler CI'da yok
- `/terim-sozlugu` canlı sitemap'te **yok** (curl ile doğrulandı)
- Sitemap'te `/etiket/*` var; konfigüratör redirect — 404 değil, "yakında" UX

---

## 2. Performans ve Hız Analizi (Core Web Vitals)

### 2.1 Açılış Hızı

**Hedef:** Mobil ve masaüstü < 3 sn (Lighthouse/PageSpeed)

**Google PageSpeed Insights API:** 4 Haziran 2026 oturumu — günlük quota **429 Too Many Requests**. Tam Lighthouse skoru alınamadı; Sefa manuel ölçüm yapıyor ([PageSpeed Insights](https://pagespeed.web.dev/) `/`, `/sticker`, `/sticker/yapilandir`). Aşağıdaki tahminler Claude bağımsız ön-analizinden (curl + bundle size + HTML inspeksiyon).

**Sunucu yanıt süreleri ve resource ağırlığı (4 Haz tekrar ölçüm):**

| URL | TTFB | HTML | JS chunk sayısı | Toplam JS | `<img>` sayısı |
|-----|------|------|------------------|-----------|----------------|
| `/` | 0,32 s | 63 KB | 18 | ~? | 10 |
| `/sticker` | 0,26 s | 98 KB | 18 | ~? | 31 |
| **`/sticker/yapilandir`** | 0,31 s | 40 KB | **21** | **1,285 KB** ⚠️ | 6 |

**Bundle anatomi — /sticker/yapilandir (en kritik sayfa):**

| Sıra | Boyut | Chunk | Olası içerik |
|------|-------|-------|--------------|
| 1 | **556 KB** | `0lm77yz~p33j~.js` | konva (canvas) + pdfjs-dist + jspdf birleşik olası |
| 2 | 211 KB | `0zwa2uy~wixsr.js` | React framework / vendor |
| 3 | 109 KB | `03~yq9q893hmn.js` | UI kütüphaneleri |
| 4-9 | ~50 KB × 6 | — | Sayfa kodları |
| Toplam | **1,285 KB** | | |

**Hero görsel ağırlığı (LCP adayı, ana sayfa):**

| Boyut | Format | Ağırlık |
|-------|--------|---------|
| 640w (mobile) | JPEG q=75 | 27 KB ✓ |
| 1920w (desktop) | JPEG q=75 | 107 KB 🟡 (AVIF olsaydı ~40 KB) |

**Değerlendirme:** Sunucu TTFB hedefin çok altında (~0,3 s). **Mobil CWV problem alanı `/sticker/yapilandir`**: 1,28 MB JS parse + execute mobile 3G'de 5+ sn → TBT yüksek, TTI gecikir. Diğer sayfalar tahminen iyi.

**PSI tahmini (Claude ön-analizi, gerçek değer Sefa testinden gelecek):**

| URL | Tahmini Mobile Score | Beklenen sorun |
|-----|----------------------|----------------|
| `/` | 75-85 | LCP hero priority, font preload eksik |
| `/sticker` | 60-75 | 31 `<img>` lazy değilse |
| `/sticker/yapilandir` | **40-60** ⚠️ | TBT/TTI — JS bundle |

---

### 2.1.5 PSI gerçek ölçüm (4 Haz 20:05-20:10, **mobile**: Yavaş 4G + Moto G Power)

> **Desktop ayrı test edildi** — 3 URL'de de sorun çıkmadı (Sefa teyit, 4 Haz). Aşağıdaki tüm sayılar **mobile**. Tüm fix paketi mobile-CWV odaklı; desktop'ı bozmaz.


Sefa manuel olarak https://pagespeed.web.dev üzerinden 3 URL'yi test etti. Sonuçlar:

| URL | Perf | A11y | Best Pract. | SEO | FCP | **LCP** | TBT | CLS | SI |
|-----|------|------|-------------|-----|-----|---------|-----|-----|-----|
| **`/`** | **81** 🟡 | 93 | 100 | 100 | 1.2 s | **4.6 s** 🔴 | 150 ms | 0.01 | 3.0 s |
| **`/sticker`** | **82** 🟡 | 90 | 96 | 100 | 1.0 s | **4.4 s** 🔴 | 170 ms | 0.029 | 3.1 s |
| **`/sticker/yapilandir`** | **73** 🟡 | 88 | 100 | 69* | 0.9 s | **5.6 s** 🔴 | 310 ms | 0 | 2.0 s |

*\* yapilandir SEO 69 = "Sayfanın dizine eklenmesi engellenmiş" — **✅ BİLİNÇLİ karar doğrulandı 4 Haz, Claude curl**: `<meta name="robots" content="noindex, follow">` mevcut. Konfigüratör search'te istenmez (kullanıcı /sticker'dan girer). Aksiyon: yok.*

> **Admin trafik paneli graceful (5 Haz, commit `db1c7cc`):** SA GA4 property'ye eklenmemiş olsa bile panel ham PERMISSION_DENIED göstermez; yeşil "trafik toplanıyor" + GA4 & PostHog link kartları + katlanabilir Viewer kurulum notu gösterir. SA'ya Viewer verilince otomatik embedded'a geçer. DOM doğrulandı. GA4 client tracking (G-ZCN6RVXCEF) zaten çalışıyor (2.5K event/7gün). 503 = lokal adblock extension (gerçek kullanıcı etkilenmez).

**🔴 Ortak ana sorun — LCP TÜM SAYFALARDA KIRMIZI (4.4-5.6 s):**

LCP hedefi <2.5s yeşil, 2.5-4s sarı, >4s kırmızı. 3 sayfada da >4s. Google CWV ranking için en önemli sinyal. Tahmin (Claude) **render-blocking + hero priority + font preload eksik** kombinasyonu.

**🔴 PSI tüm sayfalarda flag'lediği ortak diagnostics:**

| Sorun | Tahmini tasarruf | Eylem ID |
|-------|------------------|----------|
| Oluşturma engelleme istekleri | **550-600 ms** | PERF-A1 (en kritik) |
| Kullanılmayan JavaScript | 212-214 KiB | PERF-4 (post-launch) |
| Eski JavaScript | 14 KiB | PERF-A2 (SWC modern targets) |
| DOM boyutunu optimize edin | — | PERF-A4 (post-launch) |
| Uzun ana ileti dizisi görevleri | 2-5 task | TBT problem — orta |

**🟡 /sticker sayfasına özel:**
- "Resim yayınlamayı kolaylaştırın" — 42 KiB (PERF-3)
- "Birleştirilmemiş animasyonlar" — 5 öğe (PERF-A3: CSS animations transform/opacity'ye)

**🟡 Erişilebilirlik sorunları (88-93 puan) → ✅ ÇÖZÜLDÜ commit `6f0b66f` + `d09b3cb`:**
- ~~Kontrast yetersiz (tüm sayfalarda)~~ → `--color-pim-mercan-koyu: #C8443A` token, ~35 küçük metin kullanımı
- ~~Link aria-label eksik~~ → header `/auth` link `aria-label="Giriş yap"` + sr-only metin
- ~~Heading sırası bozuk~~ → PriceCard.tsx h3.sr-only → h2.sr-only
- ~~ARIA yasaklanmış özellikler~~ → 7 yıldız bloğuna `role="img"` (ProductReviews + HomeReviews)

**Post-fix Lighthouse a11y skorları (Claude doğrulama, 4 Haz):**
- /: 90 → **97** ✓
- /sticker: 93 → **97** ✓
- /sticker/yapilandir: 88 → **96** ✓ (hepsi 95+ hedefi geçti)

**Kalan (P2 kozmetik):** Hero mercan-zemin beyaz-text CTA contrast 2.79 (büyük buton WCAG AA 3:1 sınırı), review card meta `text-gri-500` 2.92. Launch blocker değil.

---

### 2.1.6 Performans aksiyon listesi — ÖLÇÜM SONRASI GÜNCEL

**📝 PERF iterasyon özeti (4 Haz akşam):**

1. **`29aa3d0` PERF v1** — optimizeCss + logo priority + sticker img lazy. Critters fire etmedi (Next 16 Turbopack uyumsuz), ama logo+lazy etkili oldu.
2. **`e076da6` PERF-4 — REGRESSION ❌** — `next/dynamic` bundle split denemesi 3/3 sayfada düşüş yarattı (chunk wrapper + IntersectionObserver overhead bundle'ı %50 büyüttü).
3. **`30ef3ee` REVERT** — e076da6 geri alındı. PERF-3 (29aa3d0) durumuna döndük.

**Post-revert Claude local Lighthouse (3-run warm avg):**
- /yapilandir: **68** (LCP 4.6s, TBT 628ms) — +18 puan vs PERF-4
- /sticker: 68 (LCP 4.6s) — variance high
- /: 76 (LCP 4.5s) — variance high

⚠️ Local Lighthouse ±15 puan varyans. **Final değer için PSI cloud tekrar ölçüm gerekli.**

**Sonraki bundle split denemesi POST-LAUNCH** — yaklaşım: manuel bundle audit + mega-component refactor (3037 satır /yapilandir/page.tsx).

---

**🔴 LAUNCH ÖNCESİ ZORUNLU (PERF-1+2+A1 paketi) — 40 dk Cursor:**

| ID | İş | Süre | LCP kazanç | Sayfa skoru |
|----|-----|------|-----------|-------------|
| **PERF-1** | Hero görsel + Header logo `priority` flag | 5 dk | -800 ms | +5-10 |
| **PERF-2** | Nunito font preload (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) | 5 dk | -200 ms | +3-5 |
| **PERF-A1** | Render-blocking azaltma — Critical CSS inline + Tailwind non-critical defer | 30 dk | **-550 ms** | +10-15 |

**Bu paket sonrası tahmini sonuç:**
- LCP: 4.4-5.6s → **~2.8-3.5s** (sarı bölge, kabul edilebilir)
- Performans: 73-82 → **85-92** (yeşil bölge)
- Launch hazır ✓

**🟡 Launch sonrası (P1, ilk hafta):**

| ID | İş | Süre |
|----|-----|------|
| **PERF-3** | /sticker kart `<img>` `loading="lazy"` + `sizes` + AVIF preferans | 30 dk |
| **PERF-A2** | SWC modern browsers target (eski JS 14 KiB) | 15 dk |
| **PERF-A3** | /sticker animasyonları transform/opacity (5 öğe) | 30 dk |
| **A11Y-1** | Kontrast renk düzeltmeleri (88-93 → 95+) | 1 saat |
| **A11Y-2** | Link `aria-label`/`title` discoverable | 30 dk |
| **A11Y-3** | Heading hiyerarşisi düzelt | 30 dk |
| **A11Y-4** | /yapilandir yasaklanmış ARIA özellikleri | 30 dk |
| **SEO-1** | /sticker/yapilandir noindex kararı doğrulama (Sefa: istiyor muyuz?) | 5 dk |

**🟢 Post-launch / iyileştirme (P2):**

| ID | İş |
|----|-----|
| **PERF-4** | `next/dynamic` konva+pdfjs+jspdf (212-214 KiB unused JS) — 2 saat |
| **PERF-A4** | DOM size optimize (mega-component split) — 4 saat |
| **PERF-A5** | Long task'leri break up (2-5 long task) — 2 saat |

**Kod risk faktörleri (sabit liste):**
- `next/dynamic` kullanılmıyor — konfigüratör bundle ağır (P2 #15)
- `typescript.ignoreBuildErrors: true` — build'de tip hatası gizlenebilir
- Header logo `priority` yok — LCP riski (`TopBar.tsx`, P2 #16)
- Font preload (Nunito) yok — FOUT/CLS riski
- /sticker'da 31 img preload riski

---

### 2.1.1 Performans aksiyon listesi (PSI sonuçlarına göre önceliklenir)

**A grubu — Kesin uygulanacak (skor ne olursa olsun):**

| # | Aksiyon | Süre | Beklenen kazanç (mobile) |
|---|---------|------|--------------------------|
| **PERF-1** | Header logo + hero görsel `priority` flag | 5 dk | / +5-10 puan |
| **PERF-2** | Font preload (Nunito woff2) `<link rel="preload">` | 5 dk | tüm sayfalar +3-5 puan |
| **PERF-3** | /sticker kartlarda image `loading="lazy"` + `sizes` doğru | 30 dk | /sticker +10-15 puan |

**B grubu — Sadece /sticker/yapilandir skoru <50 ise (önemli yatırım):**

| # | Aksiyon | Süre | Beklenen kazanç |
|---|---------|------|------------------|
| **PERF-4** | `next/dynamic` ile konva + pdfjs + jspdf lazy load (yalnız ihtiyaç anında) | 2 saat | yapilandir +20-30 puan |
| **PERF-5** | webpack bundle analyzer ile dead code tespiti | 1 saat | -100-200 KB |
| **PERF-6** | jspdf yerine pdf-lib (daha küçük) değerlendirme | 4 saat | -150-300 KB |

**C grubu — Post-launch (skor 70+ ise ertelenebilir):**

| # | Aksiyon |
|---|---------|
| **PERF-7** | Hero görsel AVIF preferans (next.config.ts zaten formats sıralı) |
| **PERF-8** | Service worker / SWC compile optimizasyon |
| **PERF-9** | Critical CSS inline (above-the-fold) |

**Karar matrisi (PSI sonucu gelince):**

| /yapilandir mobile | Aksiyon |
|---|---|
| **<40** | 🔴 PERF-1 + PERF-2 + PERF-3 + **PERF-4 + PERF-5** (P0 escalation) |
| **40-60** | 🟡 PERF-1 + PERF-2 + PERF-3 + **PERF-4** (P1) |
| **60-75** | 🟢 PERF-1 + PERF-2 + PERF-3 yeterli (post-launch PERF-4) |
| **>75** | 🟢 PERF-1 + PERF-2 (kozmetik) |

---

### 2.2 Görsel Optimizasyonu

| Durum | Detay |
|-------|-------|
| AVIF/WebP | `next.config.ts` — `images.formats: ["image/avif", "image/webp"]` |
| Cache TTL | 30 gün |
| next/image | ~22 marketing dosyası |
| Ham `<img>` | 30+ dosya (configurator, sepet, proof) |
| Canlı hero | `/_next/image?url=%2Fhero%2Fhome-hero.jpg` — Next optimizer aktif ✓ |

---

### 2.3 Yük Altında Davranış (Stres Testi)

| Katman | Durum |
|--------|-------|
| Hosting | Vercel serverless `fra1` |
| DB | Supabase Frankfurt |
| Cron | 20+ job `vercel.json` |
| Load test | **Yapılmadı** — k6/Artillery repoda yok |

---

## 3. Kullanıcı Deneyimi ve Arayüz (UX/UI)

### 3.1 Mobil Uyumluluk

**Güçlü yönler (kod):**
- Tailwind mobile-first; hamburger drawer `< md`
- Sticker konfigüratör: sticky preview + `lg:hidden fixed bottom-0` CTA bar
- Ana sayfa: `md:hidden fixed bottom-0` dual CTA + `safe-area-bottom`

**Canlı HTML:** Nav'da Etiket linkinde **"Yakında"** badge görünüyor.

**FAB + sticky CTA çakışma riski (kod analizi):**

| Bileşen | Konum | z-index |
|---------|-------|---------|
| PimChat FAB | `fixed bottom-5 right-5` | z-[55] |
| Ana sayfa sticky CTA | `fixed bottom-0` full width | z-40 |
| Sticker config sticky CTA | `fixed bottom-0` full width | z-40 |

PimChat sağ altta; mobil sticky bar tam genişlik — küçük ekranlarda FAB ile CTA bar görsel çakışma olası. **Manuel iOS/Android QA gerekli.**

---

### 3.2 Navigasyon ve Hiyerarşi

**Header:** Anasayfa, Sticker, Etiket (Yakında), Şablonlar, Editör*, Panelim*, Blog, Sepet, Auth  
**Galeri:** Header'dan kaldırılmış; yalnızca footer.

**Tıklama derinliği (ana sayfadan):**

| Hedef | Tıklama |
|-------|---------|
| Sticker sipariş | ~3 |
| Sepet → ödeme | ~5+ |
| İletişim | 1–2 |
| Etiket sipariş (bugün) | Dead end (preview-only) |

---

### 3.3 Harekete Geçirici Mesajlar (CTA)

| CTA | Canlı/kod durumu |
|-----|------------------|
| "Sticker bastır" | Ana sayfa hero + mobil sticky — belirgin ✓ |
| "Etiket bastır" | Ana sayfa hero — ürün kapalı, tutarsızlık riski ⚠️ |
| "Teklif Al" | **Dedicated route yok** — `/teklif-iste` planlanmış, implement yok |
| WhatsApp toplu sipariş | Kod: `905330000000` placeholder ✗ |
| Pim chat | Global FAB ✓ |

**Canlı iletişim schema:** `iletisim/layout.tsx` — tel. `+90 531 934 01 23` (LocalBusiness JSON-LD)

---

## 4. Search Engine Optimization (SEO)

### 4.1 Tarama İzinleri

**Canlı `robots.txt` (200 OK, ~3118 byte):**
- `Allow: /`
- `Disallow: /admin/`, `/sepet`, `/odeme`, `/auth`, `/api/` vb.
- Public sayfalar indexlenebilir

**Canlı ana sayfa meta:**
- `robots: index, follow` ✓
- `canonical: https://pimetiket.com` ✓
- Test `noindex` **yok** ✓

---

### 4.2 Site Haritası

- `https://pimetiket.com/sitemap.xml` — **200 OK** (~7150 byte)
- **`/terim-sozlugu` sitemap'te yok** — footer'da link var, indeksleme gecikebilir
- GSC verification meta canlıda: `google-site-verification: Zo8iT7kPfQC_p9HU3S2KSh7Ghqw4sC6S82Bf5MJ4Lzk`

**Manuel adım:** Search Console → Sitemaps → `https://pimetiket.com/sitemap.xml` submit (API env ayrıca mevcut olabilir)

---

### 4.3 Meta Etiketler ve İçerik

**Canlı ana sayfa:**
- Title: `Pim Etiket — Markanın Etiketi, Fikrinin Sticker'ı`
- Description: online etiket ve sticker baskı odaklı ✓
- JSON-LD: Organization, WebSite (`RootJsonLd.tsx`)
- Dinamik OG PNG: `opengraph-image.tsx`
- hreflang: Yok (TR-only, bilinçli)

---

### 4.4 Görsel Alt Etiketleri

- Marketing: genelde `alt` mevcut
- `PimAsset`: dekoratif SVG — `alt=""` + `aria-label`
- Konfigüratör önizlemeleri: SEO alt zayıf (beklenen)

---

## 5. Analitik ve İzleme Kurulumları

### 5.1 Veri İzleme Araçları

**Canlı `/api/health` — tüm flag'ler true:**

| Araç | Canlı env | Consent |
|------|-----------|---------|
| GA4 | ✅ `ga4: true` | Çerez onayı sonrası (`Analytics.tsx`) |
| PostHog EU | ✅ `posthog: true` | Consent-gated |
| GSC verification | ✅ `googleSearchConsole: true` | Meta tag canlıda |
| Sentry | ✅ `sentry: true` | — |
| Vercel Analytics | Platform | Consent-gated |

**E-commerce events (kod):** `view_item`, `add_to_cart`, `begin_checkout`, `purchase` — `ga4-events.ts`

**Marketing pixel:** Çerez banner'da "henüz aktif değil" — remarketing yok.

---

### 5.2 Arama Motoru Kayıtları

| Platform | Durum |
|----------|-------|
| Google Search Console | Meta verification canlıda ✓; sitemap submit manuel doğrulanmadı |
| Bing Webmaster Tools | Opsiyonel; `indexnow.ts` + sitemap ping kodu mevcut |

---

### 5.3 Dönüşüm Kurulumları

- GA4 e-commerce funnel kodda wired
- PostHog event map mevcut
- **GA4 Real-time testi bu oturumda yapılmadı** — çerez kabul + Real-time manuel kontrol önerilir

---

## 6. Güvenlik ve Uyumluluk (Compliance)

### 6.1 Yasal Metinler

Tüm sayfalar kodda mevcut; canlı rotalar 200 döndürüyor (örneklem):

| Sayfa | Rota |
|-------|------|
| KVKK | `/kvkk` |
| Gizlilik | `/gizlilik` |
| Kullanım Şartları | `/sartlar` |
| Çerez Politikası | `/cerez` |
| Mesafeli Satış | `/mesafeli-satis` |
| Ön Bilgilendirme | `/on-bilgilendirme` |
| Cayma Hakkı | `/cayma-hakki` |
| İade-Değişim | `/iade-degisim-politikasi` |

**Çerez onay:** `CookieConsent.tsx` — opt-in, 12 ay yeniden onay, analytics consent-gated.

---

### 6.2 Yedekleme Stratejisi

| Katman | Durum |
|--------|-------|
| GitHub Actions | `.github/workflows/backup-supabase.yml` — Pazar 03:00 UTC haftalık DR |
| R2 bucket | `pimetiket-backups` — `docs/BACKUP_SETUP.md` |
| Admin UI | `/admin/yedekler` — R2 manifest listesi (read-only) |
| Restore | Manuel `pg_restore` — otomatik restore yok |
| Supabase platform | Plan bağımlı 7-gün backup |
| GO-LIVE checklist | **Pre-launch full backup adımı yok** |

**R2 env yoksa:** `/api/admin/backups` → `configured: false` + `docs/BACKUP_SETUP.md` mesajı.

**Öneri:** Canlı geçiş anında manuel Supabase snapshot + git tag + R2 workflow manuel tetikleme (`BACKUP_SETUP.md` Adım 5).

---

### 6.3 Ek Güvenlik

- Production CSP, HSTS, X-Frame-Options, Permissions-Policy ✓ (canlı header'da doğrulandı)
- Admin RBAC (`admin-rbac.ts`)
- Payment server-side validation
- `ENABLE_DEV_ENDPOINTS=false` production'da zorunlu
- KVKK talep API: `/api/me/kvkk-requests/`

---

## 7. Marka Tutarlılığı ve İçerik Check-Up

### 7.1 Metin ve Tipografi

| Öğe | Durum |
|-----|-------|
| Font | Nunito (`layout.tsx`) |
| Renkler | Mercan `#ff6b5b`, lacivert, krem |
| i18n | TR/EN sözlükler; footer kısmen TR-only |
| Lorem ipsum | Bulunmadı |
| Etiket "Yakında" vs home "Etiket bastır" CTA | Tutarsızlık riski ⚠️ |

**"Yakında" sinyalleri:** Blog boş, galeri DB boşsa boş state, iade foto upload, proof cutline PLACEHOLDER, SSS telefon "henüz aktif değil"

---

### 7.2 Görsel Dil

| Asset | Durum |
|-------|-------|
| Logo SVG | `public/pim/` |
| App icon | `src/app/icon.svg` |
| favicon.ico | Yok — SVG |
| Apple touch PNG | Yok |
| PWA manifest | SVG icon — Android zayıf |
| Manifest copy drift | "ekosistemi" vs "online etiket ve sticker baskı" |
| OG | Dinamik generator + admin `og_default` |

---

## Önceliklendirilmiş Bulgu Matrisi

### P0 — Canlıya çıkmadan önce

| # | Bulgu | Doğrulama |
|---|-------|-----------|
| 1 | ~~www → apex redirect yok~~ | ✅ **ÇÖZÜLDÜ** — commit `03f0c21`, curl doğrulandı 4 Haz |
| 2 | ~~WhatsApp `905330000000` placeholder~~ | ✅ **ÇÖZÜLDÜ** — commit `608fc9d`, bundle doğrulandı (`0afs9k7r~6orf.js` → `905456999063`) |
| 3 | ~~Destek talebi e-posta bildirimi yok~~ | ✅ **ÇÖZÜLDÜ** — commit `e52e604` + migration `153` (outbox target_type 'ticket' eklendi); admin + müşteri mail outbox'a düşüp Resend `sent` durumuna geçti |
| 4 | PayTR canlı transaction testi | Manuel (auth gerekli) |
| 5 | ~~Admin live_config ↔ UI fiyat~~ | ✅ **DOĞRULANDI** — sticker scope (canlı satış) materials/cut_multipliers DB ↔ UI eşleşmesi tam; etiket_rulo'da küçük draft drift var ama ETIKET_ENABLED=false (kritik değil) (4 Haz, Claude `scripts/inspect-pricing-config.mjs` + canlı HTTP) |
| 6 | ~~Lighthouse CWV 3 URL~~ | ✅ **ÖLÇÜLDÜ** — Sefa manuel PSI 4 Haz; LCP tümünde kırmızı (4.4-5.6s) ama Perf skor 73-82; PERF-1+2+A1 paketi launch öncesi |

### P1 — İlk hafta

| # | Bulgu |
|---|-------|
| ~~7~~ | ~~GA4 Real-time + GSC sitemap submit~~ → ✅ DOĞRULANDI (5 Haz Claude Chrome): GA4 Real-time event alıyor (grafik çubukları + direct user), PostHog 200, GSC sitemap Success (3 Haz, 42 sayfa). **GA4 collect 503 = lokal Chrome extension** (manuel fetch 204 + Real-time çubuk kanıtı, gerçek kullanıcı etkilenmez). GA4 Data API admin dashboard SA engeli → post-launch P2 |
| ~~8~~ | ~~`/terim-sozlugu` sitemap kararı~~ → ✅ ÇÖZÜLDÜ commit `0f27013` |
| ~~9~~ | ~~PNG favicon + apple-touch + PWA icons~~ → ✅ ÇÖZÜLDÜ commit `18b7347` (favicon.ico + 4 PNG + sharp script `scripts/generate-icons.mjs`) |
| 10 | Mobil FAB + sticky CTA QA |
| ~~11~~ | ~~Pre-launch backup runbook (GO-LIVE'a ekle)~~ → ✅ ÇÖZÜLDÜ commit `0f27013` (GO-LIVE.md Adım 4.5) |
| 12 | Destek bildirim operasyonel süreç |

### P2 — İyileştirme

| # | Bulgu |
|---|-------|
| ~~13~~ | ~~Etiket launch mesajları ↔ home CTA hizalama~~ → ✅ ÇÖZÜLDÜ commit `8cbc129` (`ETIKET_ENABLED` kondisyonel home CTA — kapsam genişletildi) |
| 14 | `/teklif-iste` veya merkezi Teklif Al CTA |
| 15 | `next/dynamic` konfigüratör bundle split |
| 16 | Header logo `priority` |
| 17 | Bing Webmaster Tools |
| 18 | Sitewide link crawler CI |
| 19 | Admin destek ticket detay sayfası (`/admin/destek/[ticket_id]` dinamik route) — şu an admin mail CTA listing'e iniyor |
| ~~20~~ | ~~Hero CTA contrast kozmetik fix~~ → ✅ ÇÖZÜLDÜ commit `caef3a0` (Button primary `pim-mercan` → `pim-mercan-koyu` global, marka tüm sitede; contrast 2.79 → 4.88 WCAG AA ✓) |
| 21 | Review card meta `text-gri-500` 2.92:1 — date/author text contrast |
| ~~22~~ | ~~Konfigüratör tabaka 8 ürün için unique h1+title~~ → ✅ ÇÖZÜLDÜ commit `8ae649d` + `da9c9a5` (`sticker-product-name.ts` ortak helper, generateMetadata page.tsx'e taşındı — Next.js layout searchParams kısıtı, 7/7 unique title canlıda doğrulandı) |
| ~~23~~ | ~~Önizleme alt metni "Tabaka" → "Sticker"~~ → ✅ ÇÖZÜLDÜ (`8ae649d` aynı commit; "STİCKER · 75×75 mm · 2 ad/tabaka" canlıda görüldü) |

---

## Rapor Sonucu

Pim Etiket storefront **canlı ortamda erişilebilir ve temel altyapı sağlam** durumda:

- HTTPS zorlaması, HSTS, production CSP aktif
- Analitik env'leri (`GA4`, PostHog, GSC, Sentry, Resend) health endpoint'te **true**
- SEO teknik altyapısı (robots, sitemap, canonical, GSC meta) çalışıyor
- Fiyat regression scriptleri geçti
- Sunucu TTFB hızlı (~0,3 s)

**Açık riskler:** www canonical redirect eksikliği, WhatsApp placeholder, destek mail bildirimi yokluğu, tam Lighthouse CWV ölçümünün tamamlanmaması, etiket "Yakında" ile home CTA tutarsızlığı.

**Önerilen minimum canlı test paketi:** [`GO-LIVE.md`](../GO-LIVE.md) Adım 5 + PageSpeed 3 URL + çerez kabul → GA4 Real-time + auth magic link + sticker uçtan uca + Vercel www redirect ayarı.

---

*Rapor oluşturulma: 4 Haziran 2026 · Doğrulama araçları: curl, npm scripts, `/api/health`, canlı HTML inceleme*
