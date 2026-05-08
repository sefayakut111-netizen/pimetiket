# Pim Etiket — Master Plan

**Sürüm:** 1.0
**Tarih:** 2026-05-08
**Durum:** Yaşayan doküman — her milestone sonrası güncellenir

---

## Vizyon

Türkiye'nin **AI destekli akıllı dijital baskı atölyesi**.
Düşük MOQ + geniş malzeme + esnek süreç. Bursa'dan, küçük markalar için.
Üretim **fason ortaklarda**; biz vitrin + operasyon + müşteri yönetimi.

**1. faz hedefi:** 6-8 hafta içinde **MVP canlı**, ilk 5-10 pilot müşteri.
**2. faz:** B2B/KOBİ portali, mobil RN, canvas tasarım editörü.

---

## 🟢 Tamamlananlar

| Adım | Commit | Çıktı |
|---|---|---|
| **A** | `fadd580` | Workspace + git init + 21 design prototype dosya organize edildi |
| **B** | `428fb3f` | `DESIGN_SYSTEM.md` (9 bölüm) + `PIM_MASCOT_BRIEF.md` (kanonik karakter spec) |
| **C** | `1104621` | v1-jsx'e 6 mikro fix: FormSection/SelectableCard/PriceCard ortak component'ler + 5 yeni tasarım token |

---

## 🔵 Karar bekleyen meseleler

Bu kararları **D başlamadan önce** netleştirmek **gerekmez** ama F-K arası adımlar için kritik. Şimdiden düşünmeye başla:

| Konu | Seçenekler | Etkilediği adım |
|---|---|---|
| **Payment provider** | iyzico (kolay onboarding) / ParamPOS (Packanalyz'de var) / Stripe (TR'de KDV/E-fatura kısıtlı) | H |
| **Backend host** | Railway ($5+/ay, sıfır ops) / Hetzner ($5/ay, Docker gerek) / Render | F, L |
| **Storefront host** | Vercel (Next.js evi) / Cloudflare Pages (Packanalyz'de var) | E, L |
| **E-fatura sağlayıcı** | Foriba / Logo / QNB / Mikro / İzibiz | K |
| **Kargo default** | Yurtiçi / Aras / Sürat / MNG (hepsi entegre, ilki default) | K |
| **Sosyal login** | MVP'de mi (Google + Apple) yoksa v1.1'e mi | E.2 |
| **Cüzdan / kredi sistemi** | Brief'te "%2 indirim ile yatır" var — MVP'de mi yoksa v1.1'e mi | F, G |
| **Demo hesap** | Müşteri kaydı öncesi denemek için var mı? | E.2 |

---

## 🛠️ Yol haritası — Kalan 9 adım

### **D** — Next.js + Tailwind storefront scaffold (~75 dk)

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

### **E** — Sayfa migration (3 alt-faz, ~3 hafta)

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

### **F** — Medusa v2 backend scaffold (~1 gün)

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

### **G** — Custom Modules (~1.5 hafta)

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

### **H** — Payment provider (~3-5 gün)

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

### **I** — Sipariş state machine + Frontend↔Backend entegrasyonu (~2 hafta)

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

### **J** — Operatör admin paneli (~5-7 gün)

Medusa admin v2'nin slot/widget API'siyle E.3'teki 5 admin sayfasının **gerçek backend'e bağlanması**.

| Görev |
|---|
| `/admin` route extension'lar |
| AI QC kuyruğu için custom widget |
| Prova üretim arayüzü (görselleştirme) |
| Fason ortakları yönetim CRUD |
| Operatör kullanıcı rolü + yetki sistemi |

---

### **K** — E-fatura + Kargo entegrasyonu (~1.5-2 hafta)

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

### **L** — Production deploy + monitoring + soft launch (~1 hafta)

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
