# 📁 Sipariş Dosyalarının Uçtan Uca Akışı

> Bir müşteri tasarım dosyası yüklediğinde sistemde dolaşan **5 farklı dosya türü**
> + **6 farklı storage konumu** + **8 yaşam döngüsü olayı** vardır.
> Bu dokümanın amacı: ileride bir şey değiştiğinde (örn. R2'ye taşıma, yeni
> bucket eklemek) etkilenen yerleri tek bakışta görmek.

**Versiyon:** v1.0 · **Tarih:** 21 Mayıs 2026

---

## 0. Hızlı Özet (TL;DR)

Bir müşteri etiket sipariş ederse dosyaları **5 storage konumundan** geçer:

```
Browser localStorage ──► Supabase Storage ──► Supabase DB (metadata)
                              │
                              ├── designs/         (orijinal upload)
                              ├── cutlines/        (kesim çizgisi SVG)
                              ├── design-previews/ (sepet thumbnail)
                              └── gallery/         (admin için)
                                       │
                                       ▼ (90 gün hareketsizlik)
                              Cloudflare R2 archive
                                       │
                                       ▼ (24 ay sonra son siparişten)
                              KVKK purge (hard delete)
```

**5 dosya türü:** orijinal tasarım, cutline SVG, preview PNG, proof PDF, kargo etiket PDF

---

## 1. Aşama Aşama Yolculuk

### Aşama A — Konfigüratör (sepete eklemeden önce)

**Konum:** Tarayıcı (localStorage) + **Supabase Storage: `design-previews/`**

| Olay | Dosya | Nerede saklanır |
|------|-------|----------------|
| Müşteri /etiket/yapilandir'da dosya seçer | `kullanici-dosya.pdf` | Tarayıcı RAM'i (henüz upload YOK) |
| Konfigüratör bir PNG preview render eder | `preview.png` (~200KB) | **`design-previews/{user_id}/{design_id}.png`** (5MB limit, public read, RLS: sadece sahip yazar) |
| "Sepete ekle" butonu | metadata + design_id | localStorage (`pim_cart_v2`) — kullanıcı henüz login değilse |

**Tablo:** `cart_design_preview` (sadece preview URL'i tutar, dosya bucket'ta)
**Migration:** `072_cart_design_preview.sql`

> 💡 **Neden preview ayrı?** Konfigüratörde "Sonra yüklerim" seçilmiş olabilir, asıl dosya yok ama sepet thumbnail göstermek istiyoruz.

---

### Aşama B — Ödeme + Sipariş Oluşturma

**Konum:** Henüz dosya yok (PayTR akışı)

| Olay | Dosya |
|------|-------|
| PayTR iframe çıkışı + IPN success | Sipariş `paid` olur |
| Sepet ürünleri `orders.items_snapshot`'a kopyalanır | Sadece JSON metadata (config, qty, price) |
| Trigger `paid → proof_pending` veya `awaiting_upload` | Bağlıdır: müşteri tasarım yükledi mi? |

---

### Aşama C — Tasarım Upload (asıl dosya buraya iner)

**Konum:** **Supabase Storage: `designs/`** + **Tablo: `design_files`**

| Olay | Dosya | Nerede saklanır |
|------|-------|----------------|
| Müşteri `/siparis/[orderId]/tasarim-yukle` sayfasını açar | — | — |
| Dosya seçer (PDF/PNG/JPG/SVG, max ~25MB) | `etiket-v3.pdf` | **`designs/PE-2026-1234/{uuid}.pdf`** |
| Upload tamamlanır | SHA-256 hash hesaplanır | `design_files` tablosuna kayıt |
| AI ön-kontrol (boyut/format/DPI) tetiklenir | — | `design_files.status = uploaded` |

**Tablo:** `design_files`
```sql
id, order_id, user_id, order_item_id,
storage_path,        -- "designs/PE-2026-1234/abc-xyz.pdf"
original_name,       -- "etiket-v3.pdf"
size_bytes, mime_type,
sha256,              -- duplicate detection + integrity
version,             -- 1, 2, 3... (aynı item için tekrar yükleme)
status               -- uploaded → qc_pending → qc_passed | qc_flagged
```
**Migration:** `003_returns_design_files.sql`

**Geçici upload (sepete eklerken):** `design_temp_uploads` tablosu — 24 saat sonra otomatik temizlenir (Migration 008).

---

### Aşama D — AI QC (OpenAI Vision)

**Konum:** **`design_files.status`** state machine + outbound call

| Olay | Dosya nereye gider? |
|------|---------------------|
| Cron veya post-upload trigger | `designs/...` dosyasına Supabase **signed URL** üretilir (5dk geçerli) |
| OpenAI Vision'a POST | URL → görsel analiz (DPI, çözünürlük, transparency, format) |
| Sonuç DB'ye yazılır | `design_files.status = qc_passed / qc_flagged` |

**Endpoint:** `/api/agents/design-qc`
**Statü geçişleri:**
- `qc_passed` → akış devam (proof üretimi)
- `qc_flagged` → operatör review (`/admin/ai-qc`)
- `qc_rejected` → müşteriye mail + dosya tekrar iste

---

### Aşama E — Cutline POC (kesim çizgisi üretimi)

**Konum:** **Supabase Storage: `cutlines/`** + **Tablo: `cutline_designs`**

| Olay | Dosya nereye gider? |
|------|---------------------|
| Müşteri `/onay/[orderId]` sayfasını açar | Sayfa hidden iframe `/onay/duzenle?headless=1` yükler |
| POC iframe `designs/...` dosyasını okur | Headless: dosyayı parse + kesim çizgisi üretir (contour / hull / rect / circle) |
| postMessage ile parent sayfaya SVG döner | parent `cutline_designs` tablosuna INSERT |
| SVG dosyası R2'ye yazılır | **`customer-cutlines/{order_id}/{item_id}/{ts}.svg`** |
| Önizleme PNG render edilir | `preview_png_url` opsiyonel |

**Tablo:** `cutline_designs`
```sql
id, order_id, order_item_id, user_id,
svg_url,             -- R2 key
preview_png_url,
source,              -- raster | vector | psd | operator-override
mode,                -- contour | hull | rect | circle | operator
offset_mm,           -- 2.0 default (bleed)
status               -- auto | approved | rejected | manual
```
**Migration:** `059_proof_approval_flow.sql` + `062_auto_cutline_state.sql` + `063_multi_design_proof.sql`

> 💡 **Multi-design:** 1 order_item içinde birden fazla farklı tasarım olabilir (örn. 3 etiket varyantı). Her tasarım için ayrı `cutline_designs` satırı.

---

### Aşama F — Müşteri Onayı

**Konum:** UI üzerinden state geçişi (yeni dosya yok)

| Olay | Etki |
|------|-------|
| Müşteri `/onay` sayfasında "Tüm baskıları onayla" butonu | `/api/orders/[id]/proof/finalize` |
| RPC `fn_finalize_proof` | `orders.status: proof_pending → proof_approved` |
| Tetik: trigger `proof_approved → in_production` (otomatik veya manuel) | Üretime alındı |

> 💡 Sefa 21 May v68: bu aşamada **mail YOK** (Faz 2 sadeleştirme). UI'da "✅ Onayın alındı, ~5 iş günü içinde kargoda" mesajı yeterli.

---

### Aşama G — Print Job Manifest (üretim partneri için paket)

**Konum:** **`/api/admin/print-job/[orderId]/manifest`** — JSON dosya (storage'a yazılmaz, anlık üretilir)

| Olay | Çıktı |
|------|-------|
| Admin `/admin/prova` sayfasında "Manifest indir" butonu | JSON response |
| Sistem son `approved` cutline'ları seçer | Her item için 1 manifest entry |
| signed URL'ler 24sa geçerli | designs/ + cutlines/ dosyalarına direct link |

Manifest yapısı:
```json
{
  "order_id": "PE-2026-1234",
  "items": [{
    "design_url": "https://...designs/PE-.../v3.pdf?token=...",
    "cutline": {
      "svg_url": "https://...customer-cutlines/.../approved.svg?token=...",
      "mode": "contour",
      "offset_mm": 2.0
    },
    "qty": 100,
    "material": "white_paper_matt"
  }]
}
```

Fason bu JSON'u alıp dosyaları çeker, üretime alır.

---

### Aşama H — Kargo Etiket PDF

**Konum:** **`/api/admin/shipping/label/[orderId]`** — PDF anlık üretilir, storage'a yazılmaz

| Olay | Çıktı |
|------|-------|
| Admin "Kargo Etiketi" butonu (admin/siparisler/[id]) | `jspdf` + `bwip-js` ile PDF |
| Türkçe fontla (TTF embedded) — adres + ürün | `application/pdf` indirme |
| Yurtıçi Kargo SOAP API'ye dispatch | Tracking number döner |

**Lib:** `src/lib/shipping/generate-label.ts`
**Migration:** Faz A.1-A.3

---

### Aşama I — Teslimat Sonrası

**Konum:** Hiçbir yeni dosya yok, sadece state değişimi + opsiyonel review-photo

| Olay | Etki |
|------|-------|
| Yurtıçi `delivered` event | `orders.status = delivered` |
| 7 gün sonra "yorum yaz" maili | `review_requests` tablosu |
| Müşteri yorum yazarken fotoğraf yüklerse | **`review-photos/{order_id}/{uuid}.jpg`** (5MB, public read) |

**Migration:** `010_reviews_v2.sql`

---

## 2. Storage Konumları — Tek Bakışta

| Bucket | Public? | Limit | Kim yazar? | Lifecycle |
|--------|---------|-------|------------|-----------|
| **`designs`** | ❌ Signed URL | ~25 MB | Müşteri (sipariş için), Admin (sipariş için) | 24 ay rolling → R2 → KVKK purge |
| **`cutlines`** | ❌ Signed URL | ~5 MB | Müşteri (POC sonucu), Admin (override) | designs ile aynı |
| **`design-previews`** | ✅ Public | 5 MB | Müşteri (sepet thumbnail) | Sepet temizlenince orphan |
| **`review-photos`** | ✅ Public | 5 MB | Müşteri (delivered+7gün) | KVKK m.5/1 — sonsuz tutulur |
| **`gallery`** | ✅ Public | 10 MB | Admin (anasayfa galeri) | Süresiz |
| **`fason-contracts`** | ❌ Signed URL | 10 MB | Admin (üretici sözleşmesi) | Süresiz (yasal) |

> ⚠️ **Cloudflare R2 bucket:** `pim-etiket-archive` — 90 gün hareketsiz müşterilerin tüm dosyaları toplu olarak buraya taşınır (cold storage).

---

## 3. Yaşam Döngüsü (Lifecycle Olayları)

### Anlık (0-5 dk)
1. Konfigüratör preview PNG yüklenir (~200KB)
2. Müşteri ödeme yapar
3. Tasarım upload (designs/)
4. AI QC tetiklenir (OpenAI Vision çağrısı)
5. Cutline POC headless çalışır (browser background iframe)

### Kısa vadeli (1 gün)
- `design_temp_uploads` 24 saat sonra otomatik silinir (eğer siparişe bağlanmamışsa)
- Signed URL'ler 5dk-24sa arası geçerli (yenileniyor)

### Orta vadeli (1 hafta)
- Teslim sonrası 7. gün → "yorum yaz" maili
- Müşteri review-photo yüklerse → permanent

### Uzun vadeli (90 gün)
- **Cron:** `/api/cron/archive-inactive` (gece 03:00)
- 90 gün hareketsiz müşterilerin tüm dosyaları **Supabase Storage → Cloudflare R2** taşınır
- `archive_records` tablosuna metadata yazılır

### Çok uzun vadeli (24 ay rolling window)
- **Cron:** `/api/cron/purge-expired-designs` (gece 04:00)
- Son siparişten 24 ay geçen tasarımlar **hard-delete** edilir (KVKK m.4 periyodik imha)
- Helper: `fn_renew_design_retention()` — tekrar baskı sayacı sıfırlar
- Soft-delete → 7 gün sonra **storage'dan da silinir** (rollback penceresi)

### Yasal saklama (10 yıl)
- Fatura, sipariş kaydı, finansal veri — `fason_mail_outbox`, `orders`, `audit_log` hiç silinmez
- Tasarım dosyası: müşteri rızası bitti → silinir, ama sipariş metadata kalır
- Helper: `fn_count_legal_purge_candidates()` — yasal süresi de biten kayıtları sayar (alarm)

---

## 4. Akış Diyagramı

```mermaid
flowchart TD
  A[Müşteri /etiket/yapilandir] -->|preview render| B[design-previews/]
  A -->|sepete ekle| C[localStorage]
  C -->|/odeme + PayTR| D[orders.paid]
  D -->|trigger| E{Tasarım var mı?}
  E -->|HAYIR| F[awaiting_upload]
  E -->|EVET| G[proof_pending]
  F -->|/siparis/X/tasarim-yukle| H[designs/]
  H --> I[design_files INSERT]
  I --> J[AI QC pipeline]
  J -->|passed| K[/onay sayfası açılır]
  J -->|flagged| L[/admin/ai-qc kuyruğu]
  J -->|rejected| M[Müşteriye mail: dosya tekrar iste]
  K -->|headless iframe| N[Cutline POC]
  N -->|SVG üretir| O[cutlines/ R2]
  O --> P[cutline_designs INSERT]
  P -->|Müşteri onayla| Q[proof_approved]
  Q --> R[in_production]
  R -->|Admin manifest| S[Print Job JSON]
  S -->|Fason indirir| T[Üretim]
  T -->|Admin kargo| U[shipping label PDF]
  U --> V[Yurtıçi pickup]
  V -->|tracking events| W[shipped → delivered]
  W -->|7gün sonra| X[Yorum yaz maili]
  X -->|opsiyonel| Y[review-photos/]
  
  W -.->|90 gün hareketsiz| Z1[R2 archive cold storage]
  Z1 -.->|24 ay rolling| Z2[KVKK hard delete]
```

---

## 5. Pratik Cevaplar — "Bir dosya nerede?"

| Soru | Cevap |
|------|-------|
| Müşterinin yüklediği orijinal dosya nerede? | `designs/PE-XXXX/{uuid}.{ext}` — Supabase Storage |
| Cutline SVG nerede? | `customer-cutlines/{order}/{item}/{ts}.svg` — Cloudflare R2 |
| Sepetteki preview thumbnail? | `design-previews/{user_id}/{design_id}.png` — Supabase Storage public |
| Üretici partner dosyaya nasıl erişir? | `/api/admin/print-job/[orderId]/manifest` JSON içindeki **24sa signed URL** |
| Müşteri kargo etiketi görür mü? | Hayır — sadece admin indirir, PDF dinamik üretilir, storage'da kalmaz |
| 24 aydan eski dosyalar? | Hard-deleted (KVKK m.4) — geri alınamaz |
| 90 gün uyuyan müşterinin dosyası? | Cloudflare R2 cold storage'da — istenince signed URL ile geri çekilir (`/api/admin/archive/signed-url`) |
| AI QC neye bakar? | OpenAI Vision — DPI, çözünürlük, format, transparency, görsel hata |
| AI QC dosyayı saklıyor mu? | Hayır — OpenAI API stateless, signed URL gönderir, sonra unutulur |

---

## 6. Risk + Bilinen Sınırlar

| Risk | Etki | Mitigasyon |
|------|------|-----------|
| OpenAI Vision down | AI QC kuyrukta birikir | Manuel `/admin/ai-qc` review fallback + circuit breaker (Mig sonrası 10dk rolling) |
| R2 down | Cutline kaydı fail | `cutline_designs.svg_url` NULL, müşteri tekrar dene |
| Supabase Storage 25MB limit | Büyük PSD'ler reddedilir | Upload formunda "ZIP olarak gönder" CTA |
| KVKK purge bug → silinmemesi gerekenler | Hukuki risk | Daily audit `cron/auditors/data_hygiene` (Pazartesi/Salı) |
| Müşteri dosyayı tekrar indirmek ister | Storage'dan silinmiş olabilir | 24 ay içinde signed URL üretilebilir; sonrası "üzgünüz, KVKK ile sildik" |
| Duplicate upload | İki kez aynı dosya | SHA-256 hash kontrolü `design_files.sha256` |

---

## 7. İlerideki İyileştirmeler (yapılmadı, not düşülüyor)

- [ ] Müşteri panelinde "Tasarımlarım" sayfası — eski siparişlerin dosyalarını tek yerden gör
- [ ] Drag&drop ile çoklu dosya upload (şu an tek tek)
- [ ] PDF preview generation server-side (şu an tarayıcıda render)
- [ ] CDN edge cache `design-previews/` için (şu an direct Supabase Storage)
- [ ] R2 ile direct upload (büyük PSD'ler için Supabase 25MB sınırını aşmak)

---

**Son güncelleme:** 21 Mayıs 2026
**İlgili belgeler:** `SIPARIS-AKISI-SNAPSHOT.md`, `ADMIN-AKISI-SNAPSHOT.md`, `SISTEM-AKISLARI.md`
