# Pim Etiket — Master Plan

**Sürüm:** 2.0
**İlk yazıldı:** 2026-05-08
**Son güncelleme:** 2026-05-09
**Durum:** Yaşayan doküman — her milestone sonrası güncellenir

---

## Vizyon

Türkiye'nin **AI destekli akıllı dijital baskı atölyesi**.
Düşük MOQ + geniş malzeme + esnek süreç. Bursa'dan, küçük markalar için.
Üretim **fason ortaklarda**; biz vitrin + operasyon + müşteri yönetimi.

**1. faz hedefi:** 6-8 hafta içinde **MVP canlı**, ilk 5-10 pilot müşteri.
**2. faz:** B2B/KOBİ portali, mobil RN, canvas tasarım editörü.

---

## 🟢 Tamamlananlar (kronolojik)

| # | Adım | Commit | Tarih | Çıktı |
|---|---|---|---|---|
| 1 | **A** workspace + git init | `fadd580` | 05-08 | 21 design prototype dosya organize |
| 2 | **B** design system + mascot brief | `428fb3f` | 05-08 | DESIGN_SYSTEM.md (9 bölüm) + PIM_MASCOT_BRIEF.md |
| 3 | **C** v1-jsx mikro fix'ler | `1104621` | 05-08 | 6 fix + 5 yeni token |
| 4 | **D** Next.js + Tailwind storefront scaffold | erken | 05-08 | Next 16 + Tailwind 4 + 10 UI primitive + AppShell |
| 5 | **E.1** Public + Yasal sayfalar (12) | erken | 05-08 | /, /etiket, /sticker, /hakkimizda, /sss, /iletisim + 6 yasal |
| 6 | **E.2** Auth + Customer Account (12) | erken | 05-08 | /auth, /sepet, /odeme, /panelim, /siparis/[id] vs |
| 7 | **E.3** Admin/Operatör (5) | `32b8378` | 05-08 | /admin, /admin/siparisler/ai-qc/prova/fason |
| 8 | **F** Medusa v2 backend scaffold | `a793def` | 05-08 | medusa/ monorepo, region TR, currency TRY |
| 9 | **G** Custom modül schema (6) | `e34c282` | 05-08 | label-config, pricing-engine, qc-pipeline, proof, fason-routing, file-upload |
| 10 | **🔴 fix(storefront)** broken links + FAQ + cart a11y | `8697ad7` | 05-09 | Footer link, SSS button, sepet aria |
| 11 | **🟡 fix(consistency)** tagline + voice + i18n | `da90e6e` | 05-09 | TR→EN identifiers, OrderStatus union, lib/pricing.ts |
| 12 | **🟠 feat(ui)** Toast primitive + CTA wiring | `a09228e` | 05-09 | ToastProvider/useToast + 7 sayfada CTA bağlandı |
| 13 | **🟢 chore(seo)** metadata + robots + sitemap + JSON-LD | `123d150` | 05-09 | 33 route, Org+WebSite schema, OG, .env.example |
| 14 | **🟢 chore(a11y)** skip-link + focus-visible + fieldset | `934b3be` | 05-09 | WCAG 2.4.7, sarım fieldset, TopBar fix |
| 15 | **🟢 chore(perf)** next.config + reduced-motion + audit doc | `02b5925` | 05-09 | AVIF/WebP, poweredByHeader off, AUDIT-quality.md |
| 16 | **feat(pim)** Faz 1 — Karşılama Pim + GPT-4o + memory | `ec39c18` | 05-09 | Floating chat, Vercel AI SDK v6, localStorage memory, KVKK opt-in, 7 persona spec |
| 17 | **docs(plan)** v2 — 5-blok roadmap | `1fbbd04` | 05-09 | 16 milestone tablosu + Block A-E + kritik prensipler |
| 18 | **docs(pricing)** Sefa'nın modülü analizi | `8b91a8b` | 05-09 | sticker-fiyatlama.html v0.3 incelendi, 8 soru + entegrasyon planı |
| 19 | **feat(pricing)** TS port (geometri + cost + cart) | `2095b17` | 05-09 | Saf fonksiyon port (~820 LOC) + 46 Jest senaryo + PRICING_SPEC.md |
| 20 | **docs(manual-order)** feature spec | `de0fdfb` | 05-09 | Manuel sipariş hazırlama Block C.8 olarak eklendi, MANUAL_ORDER_FEATURE.md |
| 21 | **feat(admin)** /admin/fiyat-hesapla | `7655abf` | 05-09 | Operatör manuel fiyat hesap aracı + parametre tuning, lib storefront'a kopyalandı, ~700 LOC |
| 22 | **feat(admin)** SVG görselleştirme | `a17b031` | 05-09 | RollPlanSvg + SheetPreviewSvg + RollMiniBar (~1.030 LOC), kesim markası/başlangıç/fire pattern'ler |
| 23 | **fix(pricing)** rulo plan layout + fontlar | `5fa8996` | 05-09 | Outer/inner loop swap (cols/rows) → tabakalar artık rulodan taşmıyor, 11 font 1.5-2× büyütüldü |

**Toplam**: 23 atomik milestone, ~36 commit, ~17.000 LOC.

---

## 📅 Session 2026-05-09 — Günün özeti

**12 commit, ~7.000+ LOC, 7 doc**. Üç ana iş bloğu:

### 1. Quality polish (a09228e → 02b5925) — 4 commit
- 🟠 Toast primitive + 7 sayfada CTA wiring
- 🟢 SEO: metadata template, robots, sitemap, Org+WebSite JSON-LD, 33 route
- 🟢 A11y: skip-link, focus-visible global, fieldset semantics, TopBar sepet aria
- 🟢 Perf: next.config tuning + reduced-motion + AUDIT-quality.md

### 2. Pim AI Agent Faz 1 (ec39c18) — 1 commit
- Karşılama Pim + GPT-4o + Vercel AI SDK v6
- localStorage memory (KVKK opt-in) + 7 persona spec
- Floating chat (sağ alt mercan buton) + consent panel + welcome chip'ler
- Medusa pim-memory module scaffold (5 model)
- `OPENAI_API_KEY` set edildiğinde anında çalışır

### 3. Pricing engine entegrasyonu (1fbbd04 → 5fa8996) — 7 commit
- PLAN v2: 5-blok roadmap (eski D-L → A/B/C/D/E)
- Sefa'nın `sticker-fiyatlama.html` v0.3 (4315 LOC) analizi → PRICING_ANALYSIS.md
- Saf fonksiyon TS port: geometri + cost + cart-discount (~820 LOC) + 46 Jest senaryo + PRICING_SPEC.md (kanonik referans)
- Manuel sipariş feature spec (Block C.8) → MANUAL_ORDER_FEATURE.md
- `/admin/fiyat-hesapla` admin sayfası: input formu + price hero + cost breakdown
- 3 SVG görselleştirme: RollPlanSvg + SheetPreviewSvg + RollMiniBar
- Layout bug fix (cols/rows loop swap) + font'ların 1.5-2× büyütülmesi

### 🟢 Çalışan canlı
- 34 route storefront (33 statik + 1 dynamic)
- TS clean
- Admin'de "Fiyat" sekmesi → manuel fiyat hesap + SVG görselleştirme

### 🔄 Sıradaki — beklenenler
- Sefa: `OPENAI_API_KEY` set et → Pim canlı
- Sefa: Supabase yeni org/proje aç → Block B açılır
- Sefa: Pricing parametre tuning kararları → Block A.4-A.5 (DB models, service)
- Block A.6-A.7 (storefront configurator'larını shared lib'e bağlama) — istendiğinde yapılır

### 📂 Doc inventory (8 dosya)
1. **PLAN.md** — master plan, 23 milestone, 5-blok roadmap
2. **DESIGN_SYSTEM.md** — design tokens (B'den beri)
3. **AUDIT-quality.md** — SEO/A11y/Perf audit özeti
4. **PIM_AGENT.md** — AI agent vizyonu + 4 faz roadmap
5. **PRICING_SPEC.md** — Sefa'nın kanonik pricing spec'i
6. **PRICING_ANALYSIS.md** — entegrasyon planı + 11 mimari uyarı
7. **MANUAL_ORDER_FEATURE.md** — Block C.8 spec
8. **PIM_MASCOT_BRIEF.md** — maskot kanonik karakter spec'i (B'den beri)

---

## 📍 Mevcut durum (2026-05-09)

**Çalışıyor**:
- Storefront Next 16 + Tailwind 4: 33 route, 32 statik prerender + 2 dinamik (`/api/pim/chat`, `/siparis/[id]`).
- 29 sayfa mock data ile canlı, görsel onay alındı.
- Pim Karşılama AI (GPT-4o) — `OPENAI_API_KEY` set edilince çalışır.
- Build: `npm run build` ✓ TS clean.

**Kapı (gate)**:
- 🔄 **Pricing module** Sefa lokal'de kodluyor → bekleniyor. Geldiğinde **Block A** açılır.
- ⏳ Supabase yeni org/proje (Pim Etiket için) — açılmadı.
- ⏳ ParamPOS / iyzico karar — verilmedi (H bağımlılığı).

**Karar verildi**:
- Pim brain: GPT-4o (`gpt-4o-mini` ileride cost-down).
- Pim voice: Bursa esnaf samimiyeti, "sen", abartısız, emoji minimum.
- Pim ekibi: 7 persona (1 aktif Karşılama + 6 placeholder).
- Site URL: `https://pimetiket.com` canonical, env `NEXT_PUBLIC_SITE_URL`.
- 🟢 quality polish kategorisi tamamlandı (SEO/A11y/Perf), `docs/AUDIT-quality.md`.

---

## 🚧 Sıradaki — 5-Blok Roadmap

Bu plan eski D-L lineer sıralamayı **rework önleyecek şekilde** yeniden organize ediyor. Eski D-L detayları aşağıda referans olarak duruyor.

### Block A — Pricing single-source-of-truth 🔄 **GATE**

**Tetikleyici**: Sefa pricing modülünü atınca açılır.

| # | İş | Çıktı |
|---|---|---|
| A.1 | Sefa'nın pricing modülünü oku, mantığı haritala | — |
| A.2 | `medusa/src/modules/pricing-engine/` schema'yı modüle göre güncelle | Migration hazır |
| A.3 | `storefront/src/lib/pricing.ts` SADECE shared module'u import etsin (configurator'da hardcoded `MAT_PRICE` kalmayacak) | Tek kaynak |
| A.4 | `etiket/page.tsx` + `sticker/page.tsx` shared lib'i tüketsin | Yan etki yok, build temiz |
| A.5 | Birim test: tier discount, size factor, KDV | `vitest` ilk dosya |

**Süre**: 4-6 saat.

---

### Block B — Backend foundation

| # | İş | Bağımlılık |
|---|---|---|
| B.1 | Supabase yeni org + proje | Sefa hesap açacak |
| B.2 | Medusa env: `DATABASE_URL` + `JWT_SECRET` + `COOKIE_SECRET` | B.1 |
| B.3 | `medusa db:migrate` — 6 modül + core | B.2 |
| B.4 | Auth (email + password), OAuth Faz 4'te | B.3 |
| B.5 | Seed data: malzeme + kaplama + örnek 3 sipariş | A.2 + B.3 |
| B.6 | Storage (Supabase Storage veya Cloudflare R2) | B.1 |

**Süre**: 1-2 gün.

---

### Block C — Storefront ↔ Medusa entegrasyonu (eski "I" adımı)

| # | İş | Bağımlılık |
|---|---|---|
| C.1 | Medusa SDK kurulum + `lib/medusa/client.ts` (singleton) | B |
| C.2 | `/auth` ↔ Medusa auth provider | B.4 |
| C.3 | Cart store (Zustand) ↔ Medusa cart API | B.3 |
| C.4 | `/odeme` ↔ Medusa checkout (Stripe sandbox geçici, ParamPOS Faz 4) | B.3 |
| C.5 | `/profil`, `/cuzdan`, `/adreslerim`, `/fatura-bilgileri`, `/siparislerim` ↔ customer API | B.3 |
| C.6 | `/admin/*` ↔ admin API | B.4 |
| C.7 | File upload: `/etiket` configurator'a dosya alanı + Storage | B.6 |
| C.8 | **Manuel sipariş hazırlama** — `/admin/manuel-siparis` + token-bazlı `/sepet/[token]` müşteri linki + 3 kanal paylaşım (kopyala/WhatsApp/email). Detay: [MANUAL_ORDER_FEATURE.md](./MANUAL_ORDER_FEATURE.md) | A + B + C.4 |

**Süre**: 3-5 gün (C.8 dahil 5-6 gün).

---

### Block D — Pim Faz 2-4 (paralel akış)

D.1 backend gerektirmez (configurator state client-side), B/C ile paralel ilerleyebilir. D.2-D.4 backend bağımlı.

| Faz | İş | Bağımlılık | Sıra |
|---|---|---|---|
| **D.1** Tasarımcı Pim | Configurator handoff + brief çevirici (function calling: `set_configurator`, `set_qty`, `redirect_to_product`) | A bitmeli | A bitince başlar |
| **D.2** Memory swap | localStorage → Supabase server-side (`pim-memory` modülü canlı) | B + C.2 | C bitince |
| **D.3** Operatör/Kargocu/Ustabaşı Pim | Sipariş lookup, kargo takip, üretim durumu tool'ları | C bitmeli | C sonrası |
| **D.4** Muhasebeci + Mevzuat Pim | Fatura, **Packanalyz API köprüsü** | C + Packanalyz API | post-launch |

---

### Block E — Polish + Deploy (eski "L" adımı)

| # | İş | Bağımlılık |
|---|---|---|
| E.1 | Yasal sayfa GERÇEK içerik (KVKK m.10, MesafeliSatis m.5, Cayma vs.) | Sefa MERSİS/adres/avukat |
| E.2 | OG image (1200×630), apple-icon, favicon set | Pim mascot final |
| E.3 | Pim mascot profesyonel vektör (PIM_MASCOT_BRIEF.md) | — |
| E.4 | Cloudflare Pages deploy + GitHub Actions CI | C bitmeli |
| E.5 | DNS pimetiket.com | E.4 |
| E.6 | Smoke test: 5 kritik flow | C bitmeli |
| E.7 | UptimeRobot + Sentry + PostHog | E.4 |

---

## 🔁 Kritik prensipler — rework önleme

1. **Pricing önce, Pim Faz 2 sonra**: Pim "2000 kraft etiket fiyatı?" diye sorulduğunda hardcoded değer değil, shared pricing lib'den çağıracak. A bitmeden D.1'e başlamayız.
2. **Memory interface stable**: `memory.ts`'teki `readMemory/writeMemory` arayüzü değişmeden Supabase'e swap olacak. Faz 1 kodu korunur.
3. **Mock data sadece UI'da**: Backend response'ları için typed interface'ler (`Order`, `Address`) duruyor. C bloğunda gerçek API'ya geçince TS hataları rehber.
4. **Pim persona spec dondu**: 7 persona, brand voice, KB tek dosyada (`personas.ts`). Eklemeler system prompt'a satır eklenir.
5. **Yasal metinler gate**: Sefa'nın domain bilgisi/MERSİS/avukat onayı bekliyor. **E.1 geç tamamlanırsa go-live geç olur** — paralel başlatılabilir.

---

## 🔵 Karar bekleyen meseleler

| Konu | Seçenekler | Etkilediği adım |
|---|---|---|
| **Payment provider** | iyzico (kolay onboarding) / ParamPOS (Packanalyz'de var) / Stripe sandbox geçici | C.4, H |
| **Backend host** | Railway ($5+/ay, sıfır ops) / Hetzner ($5/ay, Docker gerek) / Render | B, E.4 |
| **Storefront host** | Cloudflare Pages (Packanalyz'de var) / Vercel (Next.js evi) | E.4 |
| **E-fatura sağlayıcı** | Foriba / Logo / QNB / Mikro / İzibiz | post-launch |
| **Kargo default** | Yurtiçi / Aras / Sürat / MNG | post-launch |
| **Sosyal login** | MVP'de mi yoksa v1.1'e mi | C.2 |
| **Pim Faz 2 visual** | 7 persona için kostüm overlay sistemi mi yoksa ayrı SVG'ler mi | D.1 |
| **Yasal kişilik** | Pim Etiket de Sefa Yakut şahıs işletmesi mi (Packanalyz gibi) yoksa ayrı tüzel kişilik mi | E.1 |

---

---

## 📚 Tarihi referans: orijinal D-L roadmap (2026-05-08)

> **Not**: Bu bölüm tarihi referans amaçlıdır. **Aktif plan yukarıdaki 5-blok roadmap'tir.** D-E ✅ tamamlandı, F ✅ scaffold edildi (G schema), H/I/J/K/L → 5-blok plana göre yeniden organize edildi.

### **D** — Next.js + Tailwind storefront scaffold ✅ TAMAMLANDI

`storefront/` klasörü altında Next.js 14 + TypeScript + Tailwind + App Router.

| Alt-adım | Süre | Çıktı |
|---|---|---|
| D.1 | 5 dk | `npx create-next-app@latest storefront` — boş Hello World, port 3000 |
| D.2 | 15 dk | `tailwind.config.ts` (DESIGN_SYSTEM.md §7) + `globals.css` + Nunito font (`next/font`) |
| D.3 | 20 dk | `src/components/Pim.tsx` (9 pose enum + TS) + `src/components/Icon.tsx` (lib) |
| D.4 | 25 dk | UI lib: `Button`, `Card`, `Pill`, `Input`, `Eyebrow`, `SelectableCard`, `FormSection`, `PriceCard`, `StageDot`, `QtySlider` — `src/components/ui/` |
| D.5 | 10 dk | `<AppShell>` layout (topbar + footer + container) |

**Çıktı:** Üzerine sayfa yazılabilir, design-system'le %100 uyumlu Next.js scaffold.
**Bağımlılık:** Yok. Hemen başlanabilir.

---

### **E** — Sayfa migration ✅ TAMAMLANDI

v1+v2 taslaklarını **27 MVP sayfayı** Next.js + TS + Tailwind'e taşı.

#### E.1 — Public/Marketing (9 sayfa, ~3-4 gün)

| # | Sayfa | URL | Karmaşıklık |
|---|---|---|---|
| 1 | Anasayfa | `/` | 🟡 Orta — hero, 3 pillar, ürün kartları, how-it-works, testimonials, FAQ, CTA |
| 2 | Etiket konfigüre | `/etiket` | 🔴 Yüksek — 5 step, canlı fiyat, 3D-ish preview, sarım yönü 8 varyant |
| 3 | Sticker konfigüre | `/sticker` | 🟡 Orta — 5 step, tier kartlar, canlı sticker preview |
| 4 | Hakkımızda | `/hakkimizda` | 🟢 Düşük |
| 5 | SSS | `/sss` | 🟡 Orta — kategorize accordion |
| 6 | İletişim | `/iletisim` | 🟢 Düşük — WhatsApp, mail, atölye, harita iframe |
| 38-43 | Yasal 6 sayfa | `/mesafeli-satis`, `/cayma-hakki`, `/kvkk`, `/gizlilik`, `/cerez`, `/sartlar` | 🟡 Orta — Packanalyz'deki yasal şablonları yeniden kullan, AVUKAT İNCELEMESİ ŞART |

#### E.2 — Auth + Customer Account (12 sayfa, ~5 gün)

| # | Sayfa | URL |
|---|---|---|
| 10 | Giriş/Kayıt | `/auth` veya modal |
| 11 | Şifre sıfırla | `/sifre-sifirla` |
| 13 | Panelim | `/panelim` |
| 14 | Sepet | `/sepet` |
| 15 | Checkout | `/odeme` (3DS, KDV, fatura tipi) |
| 16 | Ödeme sonucu | `/odeme-sonuc` |
| 17 | Sipariş detayı | `/siparis/[id]` (statü timeline + dosya yükleme + prova onay) |
| 20 | Tüm siparişlerim | `/siparislerim` |
| 21 | Cüzdan | `/cuzdan` (eğer MVP'de tutulursa) |
| 23 | Profil | `/profil` |
| 24 | Adres defteri | `/adreslerim` |
| 25 | Fatura bilgileri | `/fatura-bilgileri` |

#### E.3 — Admin/Operatör (5 sayfa, ~3-4 gün)

| # | Sayfa | URL |
|---|---|---|
| 29 | Admin dashboard | `/admin` |
| 30 | Sipariş yönetimi | `/admin/siparisler` |
| 31 | AI QC kuyruğu | `/admin/ai-qc` |
| 32 | Prova üretim | `/admin/prova` |
| 33 | Fason atama | `/admin/fason` |

**Notlar:**
- E adımında sayfalar **mock data** ile çalışır. Backend bağlantısı I adımında.
- Storefront tek başına Vercel'e deploy edilebilir, görsel onay için Sefa'ya canlı URL.
- Online tasarım editörü (canvas) E'de YOK — "yükle + AI QC" yeterli.

---

### **F** — Medusa v2 backend scaffold ✅ scaffold edildi (Block B'de canlandırılacak)

| Alt-adım | İş |
|---|---|
| F.1 | Yeni Supabase org/proje (Pim Etiket için ayrı, Packanalyz'le karıştırma) |
| F.2 | `npx create-medusa-app@latest backend --skip-db --skip-onboard` |
| F.3 | `.env`'e Supabase pooler + direct connection string |
| F.4 | Migrate, admin user create, dev sunucu localhost:9000 |
| F.5 | `medusa.config.ts` — region: TR, currency: TRY, KDV %20, Cloudflare R2 storage adapter |

**Bağımlılık:**
- 🔵 Sefa Supabase'te yeni org/proje açacak, connection string verecek
- Backend host kararı (Railway / Hetzner) — local'de fark etmez ama L için karar gerek

**Çıktı:** Medusa admin panel canlı (`localhost:9000/app`), boş bir Türkiye region'lı katalog.

---

### **G** — Custom Modules 🟡 schema scaffold edildi, model+service Block A+B'de doldurulacak

Medusa core'a dokunmadan `backend/src/modules/` altında özelleştirme.

| Modül | Amaç | Süre |
|---|---|---|
| `label-config` | Malzeme + kaplama + sarım yönü + emboss/yaldız varyantları (Medusa varyant modeline ek seçenek katmanı) | 2 gün |
| `pricing-engine` | Formül bazlı fiyat: `(matPrice + coatPrice + custom) × sizeFactor × tierDiscount`. Cart-add zamanı hesaplanır. | 2 gün |
| `qc-pipeline` | Dosya yükleme + AI çağrısı (Claude Vision) + sonuç saklama + flag'leme | 2 gün |
| `proof` | Operatör prova üretimi + müşteri onay/red workflow | 1 gün |
| `fason-routing` | Sipariş hangi fason ortağına gidecek (kapasiteye/coğrafyaya/önceliklere göre) | 2 gün |
| `file-upload` | S3/R2 upload, signed URL'ler, 3-gün TTL warning sistemi | 1 gün |

**Çıktı:** Müşteri sipariş geçer, dosya yükler, AI flag'lerse operatör görür.

---

### **H** — Payment provider ⏳ Block C.4 + post-launch (ParamPOS)

🔵 **Karar gerekli:** iyzico mu ParamPOS mu?

| Görev |
|---|
| `medusa-plugin-iyzico` (veya custom ParamPOS provider) |
| 3DS akışı entegrasyonu |
| Webhook callback (idempotent, replay-safe) |
| Test ortamı + sandbox kart numaraları |
| Refund flow |

**Bağımlılık:** Sefa hangi provider'a karar verecek + sandbox + production credential'ları temin edecek.

---

### **I** — Sipariş state machine + Frontend↔Backend ⏳ Block C'ye dönüştü

Brief'in 7. bölümünde **eksik kalan** kritik kısım. Bu adımdan **önce** Sefa state machine'i netleştirmeli:

**Önerdiğim 11-aşama state machine** (Sefa onaylasın/değiştirsin):

```
draft → cart → payment_pending → paid → file_pending (3-gün TTL)
   → file_uploaded → ai_qc_pass / ai_qc_flag
   → operator_review → proof_pending → customer_review
   → in_production → shipped → delivered
   (her aşamada: → cancelled, → refund_pending)
```

| Alt-adım |
|---|
| State machine'i workflow engine'de model et (Medusa workflows-sdk) |
| Her state için: trigger, retry, rollback, notification |
| 3-gün TTL timer (cron veya scheduled job) — dosya yüklenmediyse "hatırlat" + iptal |
| Frontend: storefront sayfaları gerçek API'a bağlandı, Zustand veya server state |
| Email + push bildirimleri |

**Bağımlılık:** Brief'in 7. bölüm tamamlanması, F+G+H bitmiş olması.

---

### **J** — Operatör admin paneli ⏳ Block C.6'ya dahil oldu

Medusa admin v2'nin slot/widget API'siyle E.3'teki 5 admin sayfasının **gerçek backend'e bağlanması**.

| Görev |
|---|
| `/admin` route extension'lar |
| AI QC kuyruğu için custom widget |
| Prova üretim arayüzü (görselleştirme) |
| Fason ortakları yönetim CRUD |
| Operatör kullanıcı rolü + yetki sistemi |

---

### **K** — E-fatura + Kargo ⏳ post-launch (kargo Block D.3, e-fatura sonra)

🔵 **Karar gerekli:** E-fatura sağlayıcı + kargo default

| Görev |
|---|
| E-fatura provider entegrasyonu (Foriba/Logo/QNB) — sipariş ödemesi onaylanınca otomatik |
| Bireysel TC kimlik validation + e-arşiv |
| Kurumsal VKN + e-fatura |
| Yurtiçi/Aras/Sürat API entegrasyonu (3 fulfillment provider) |
| Kargo barkod yazdırma — operatör panelinden |
| Müşteriye kargo takip linki gönder |

---

### **L** — Production deploy + soft launch ⏳ Block E'ye dönüştü

| Görev |
|---|
| Storefront → Vercel (veya Cloudflare Pages) — `pimetiket.com` |
| Backend → Railway (veya Hetzner) |
| Cloudflare DNS + SSL + DDoS koruma |
| `.env` production secret'ları (Sefa) |
| GitHub Actions CI/CD |
| Sentry error monitoring |
| PostHog product analytics |
| UptimeRobot heartbeat |
| KVKK aydınlatma + VERBİS muafiyet sorgusu |
| Avukat onayı (yasal sayfalar) |
| 5-10 pilot müşteri ile soft launch |

---

## 📊 Zaman tahmini

| Faz | Süre (solo, yoğun) | Çıktı |
|---|---|---|
| D | 1.5 saat | Scaffold + UI lib hazır |
| E | 3 hafta | Tüm MVP sayfalar (mock data) canlı |
| F | 1 gün | Medusa backend ayağa kalktı |
| G | 1.5 hafta | Custom modüller işliyor |
| H | 1 hafta | Ödeme bağlandı |
| I | 2 hafta | State machine + frontend↔backend |
| J | 1 hafta | Admin paneli işlevsel |
| K | 2 hafta | E-fatura + kargo |
| L | 1 hafta | Production canlı + soft launch |
| **Toplam** | **~11-12 hafta (3 ay)** | İlk müşteriye satış yapılabilir |

> Sefa'nın Packanalyz tempolu çalışması (9 günde MVP) ile **6-8 haftaya** düşebilir.

---

## 🚦 Sefa'nın yapması gerekenler (zaman çizelgesi)

| Ne zaman | Sefa görev | Bağımlılık |
|---|---|---|
| **D'den önce** | Yok | Şu an başlanabilir |
| **D bittikten sonra** | Brief'in 7+ bölümlerini tamamla (state machine, dosya QC kuralları, operatör akışı, fason listesi, kargo tercihi) | E ve I'yı düzgün planlamak için |
| **F'den önce** | Supabase yeni org + proje aç, connection string ver | F |
| **H'den önce** | iyzico/ParamPOS karar + sandbox credential | H |
| **K'dan önce** | E-fatura sağlayıcı seç + sözleşme | K |
| **K'dan önce** | Kargo firmaları ile entegrasyon anlaşması | K |
| **K'dan önce** | Pim mascot **profesyonel vektör çizimi** (PIM_MASCOT_BRIEF.md'den) | E.1 logo bitince ideal |
| **L'den önce** | Avukat ile yasal sayfa onayı | L |
| **L'den önce** | İlk fason ortakları sözleşme + entegrasyon eğitimi | L |
| **L'den önce** | İlk 5-10 pilot müşteri belirle | L |

---

## 🎯 Öncelik akışı (özet)

```
[D scaffold]
    ↓
[E.1 public+yasal] ────→ Vercel preview, Sefa görsel onay
    ↓
[E.2 auth+customer] (mock data)
    ↓
[E.3 admin] (mock data)
    ↓                                ┌─ [G modules]
[F backend scaffold] ──────→ Medusa ─┤
    ↓                                └─ [H payment]
[I integration] ── frontend ↔ backend bağlanır, state machine canlı
    ↓
[J admin connect]
    ↓
[K e-fatura + kargo]
    ↓
[L deploy + soft launch] ──────→ İlk satış
```

---

## ⚠️ Bilinçli olarak ŞİMDİDEN dışarda bıraktıklarımız

- **Online tasarım editörü** (canvas) — 6 ay sonra Polotno/Pintura ile eklenir
- **Mobil uygulama** (RN/Expo) — PWA yeterli başlangıçta
- **B2B kurumsal portal** (cari, taksit, vade) — v2 (3-6 ay)
- **Marketplace** özelliği — yok
- **Çok dilli storefront** — TR-only başla
- **Çok döviz** (USD/EUR) — TRY-only
- **Loyalty program** — Cüzdan'daki %2 zaten basit bir teşvik
- **Tedarikçi (fason) self-service portal** — operatör arayüzünden el ile

---

## Yaşayan doküman kuralı

Bu plan **canlı belge**. Her adım bittiğinde:
- ✅ İşaretlenir
- Çıktıları + commit hash'i eklenir
- Süreyi gerçeği yansıtacak şekilde güncelle
- Yeni öğrendiğimiz şeyler "Notlar" bölümüne işlenir

Yeni bir Claude session açtığında bu dosyayı okumam yeterli — nereden devam edeceğimi bilirim.
