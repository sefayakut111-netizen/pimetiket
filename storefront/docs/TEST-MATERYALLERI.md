# 🧪 Pim Etiket — Test Materyalleri Kayıt Defteri

> Sistemde uçtan uca test yaparken kullandığımız görsellerin kaydı.
> Görsellerin kendisi `test-assets/` klasöründe (git'e gönderme yok, .gitignore'lu).

**Son güncelleme:** 21 Mayıs 2026

---

## 📋 Mevcut test materyalleri

### 1. `pikachu.png` ⭐ — TIPIK web görseli (Sefa, 21 May 2026)

> **Real-world test:** Müşterilerin %80'i internetten indirdiği görseli yükler.
> Bu dosya o davranışı yansıtır.

| Özellik | Değer | Sistem değerlendirmesi |
|---|---|---|
| **Format** | PNG (RGBA) | ✅ Transparent destekli |
| **Boyut (px)** | 1000 × 1000 | ✅ Yeterli (yüksek çözünürlük) |
| **Aspect ratio** | 1.000 (kare) | ✅ Yuvarlak/Kare sticker için ideal |
| **DPI metadata** | 72 | ⚠️ Web kalite (300 önerilen) |
| **Dosya boyutu** | 195 KB | ✅ Upload limiti dahilinde |
| **Transparent piksel** | %65.6 | ✅ Düzgün siluet |
| **Soft edge piksel** | %0.6 | ✅ Anti-aliased, cutline net |
| **Unique color** | 3.967 | ✅ Vektör-benzeri (fotoğraf değil) |
| **300 DPI fiziksel** | 8.5 × 8.5 cm | ⚠️ 8 cm üstünde DPI düşer |
| **Telif** | Pokémon karakteri | ⚠️ Sadece iç test |

**AI QC tahmini:**
- 5×5 cm baskıda → `qc_passed` (etkin 200 DPI)
- 8×8 cm baskıda → `qc_flagged` (etkin 117 DPI, sınırda)
- 10×10 cm baskıda → `qc_rejected` (etkin 100 DPI, çok düşük)

**Test senaryoları:**
- ✅ Özel Kesim Sticker (`diecut`) — kontur POC test
- ✅ Şeffaf Sticker (`clear`) — transparency test
- ✅ Yuvarlak Sticker (`circle`) — kare→daire crop test
- ⚠️ Bumper Sticker (`bumper`) — UI uyarı vermeli (aspect uyumsuz)

---

### 2. `pikachu-300dpi.png` — Premium müşteri dosyası

| Özellik | Değer | Sistem değerlendirmesi |
|---|---|---|
| **Format** | PNG (RGBA) | ✅ |
| **Boyut (px)** | 840 × 859 | ✅ |
| **DPI metadata** | 300 | ✅ **Baskı kalitesi mükemmel** |
| **Dosya boyutu** | 302 KB | ✅ |
| **Transparent piksel** | %46.5 | ✅ |
| **300 DPI fiziksel** | 7.1 × 7.3 cm | ✅ |

**Test senaryosu:** Happy path — tüm boyutlarda `qc_passed`. Acil edge case test gerekmiyor, sadece "best case" referansı.

---

### 3. `pikachu-lowres.jpg` — REDDEDİLMEsi gereken dosya

| Özellik | Değer | Sistem değerlendirmesi |
|---|---|---|
| **Format** | JPEG | ❌ Transparency yok (Şeffaf sticker olmaz) |
| **Boyut (px)** | 350 × 350 | ❌ Çok küçük |
| **DPI metadata** | 72 | ❌ |
| **300 DPI fiziksel** | 3.0 × 3.0 cm | ❌ 3 cm'de bile DPI 117 |

**Test senaryosu:** AI QC `qc_rejected` döndürmeli + müşteriye "Daha yüksek çözünürlüklü PNG yükle" maili (`sendQcRejected`) tetiklenmeli. **Negative path testi** için ideal.

---

## 🎯 E2E (uçtan uca) test prosedürü

Pikachu görselini sistemde nasıl deneyeceğiz:

### Aşama 0 — Hazırlık
- [ ] Tarayıcı **incognito** modda aç (admin oturumu karışmasın)
- [ ] PayTR **test modunda** olduğundan emin ol
- [ ] `/admin/mail-health` bir başka tab'ta açık (canlı izleme için)

### Aşama 1 — Konfigüratör (→ `design-previews/`)
- [ ] https://pimetiket.com/sticker aç
- [ ] **"Özel Kesim Sticker"** kartına tıkla
- [ ] `/sticker/yapilandir` açılır
- [ ] Adım 1: Boyut → `8×8 cm` (orta boy)
- [ ] Adım 2: Adet → `50 adet`
- [ ] Adım 3: Tasarım yükle → **`pikachu.png`** seç
- [ ] Önizleme yüklenir (sticker üzerinde Pikachu görselsel)
- [ ] **"Sepete ekle"** bas
- [ ] **Bekleniyor:** `design-previews/{user_id}/{design_id}.png` bucket'ında thumbnail (200KB civarı)

### Aşama 2 — Sepet + Ödeme
- [ ] `/sepet` açılır
- [ ] Toplam fiyat görünür (Pim AI fiyat motoru)
- [ ] **"Ödemeye geç"** → `/odeme`
- [ ] Adres bilgilerini doldur (test adresi)
- [ ] KVKK + mesafeli satış checkbox'ları işaretle
- [ ] PayTR iframe açılır → test kart `4355084355084358` (vade 12/26, CVV 000)
- [ ] **Bekleniyor:** Ödeme success → `/odeme-sonuc?status=ok`
- [ ] **Bekleniyor:** Müşteriye **"Sipariş alındı 🎉"** maili (gmail)
- [ ] **Bekleniyor:** Sefa'ya **"🛒 Yeni sipariş PE-2026-XXXX"** maili (sefayakut111@gmail.com)
- [ ] **Bekleniyor:** `/admin/mail-health` → "Resend'e iletilen" sayacı **2** olmalı

### Aşama 3 — Tasarım upload (zaten yüklenmişti, yoksa) (→ `designs/`)
- [ ] Müşteri panelinden `/siparis/PE-XXXX/tasarim-yukle` (eğer awaiting_upload state'inde isek)
- [ ] **Bekleniyor:** `designs/PE-XXXX/{uuid}.png` storage'da
- [ ] **Bekleniyor:** `design_files` tablosunda yeni satır (SHA-256 hash, version=1)

### Aşama 4 — AI QC (OpenAI Vision)
- [ ] Otomatik tetiklenir (post-upload)
- [ ] **Bekleniyor:** `design_files.status = qc_passed` (Pikachu net, transparent, yüksek çözünürlük)
- [ ] **Bekleniyor:** **"Baskı önizlemen hazır"** maili

### Aşama 5 — Cutline POC (→ `customer-cutlines/` R2)
- [ ] `/onay/PE-XXXX` açılır
- [ ] Sayfa background'da headless iframe çalışır
- [ ] **Bekleniyor:** 5 dakika içinde cutline SVG üretilir (`mode: contour`)
- [ ] **Bekleniyor:** `cutline_designs` tablosunda yeni satır, `status: auto`
- [ ] **Bekleniyor:** `customer-cutlines/PE-XXXX/{item_id}/{ts}.svg` (R2'de)
- [ ] Sayfada cutline preview gözükür — Pikachu'nun konturu çizgi olarak

### Aşama 6 — Müşteri onay
- [ ] Cutline'a bak, "Bıçağı onayla" bas
- [ ] **"Tüm baskıları onayla"** butonu aktive
- [ ] **Bekleniyor:** `orders.status: proof_pending → proof_approved → in_production`
- [ ] **Bekleniyor:** UI'da "✅ Onayın alındı, ~5 iş günü içinde kargoda" mesajı
- [ ] **Bekleniyor:** Mail YOK (Faz 2 ile iptal edildi — UI feedback yeterli)

### Aşama 7 — Admin tarafı (paralel olarak)
- [ ] `/admin/siparisler/PE-XXXX` aç
- [ ] **"Manifest indir"** butonu — JSON döner, içinde designs/ + cutlines/ signed URL'leri
- [ ] **"Kargo Etiketi"** butonu — PDF indirilir (Pikachu sticker için adres etiketi)

### Aşama 8 — Kargo + teslim
- [ ] `/api/cron/poll-shipments` manuel tetikle (DRY_RUN modu açıksa sahte event)
- [ ] **Bekleniyor:** **"Kargon yola çıktı 🚚"** maili
- [ ] (Out_for_delivery + delivered mailleri Faz 1+2 ile İPTAL — gelmez)

### Aşama 9 — 7 gün sonra (atlanır, manuel cron tetikleyebiliriz)
- [ ] `/api/cron/request-reviews` manuel tetikle
- [ ] **Bekleniyor:** **"Yorum yazar mısın?"** maili
- [ ] /yorum-yaz/{token} → 5 yıldız + yorum + opsiyonel **pikachu_review.jpg** yükle
- [ ] **Bekleniyor:** `review-photos/PE-XXXX/{uuid}.jpg`

---

## 📊 Test sonu doğrulama checklist

| # | Storage | Beklenen dosya | Kontrol |
|---|---------|----------------|---------|
| 1 | `design-previews/` | thumbnail PNG | Sepet thumbnail'inde Pikachu gözüküyor mu? |
| 2 | `designs/` | orijinal PNG | Admin panelinden indir, açılıyor mu? |
| 3 | `customer-cutlines/` (R2) | cutline SVG | Pikachu silüetinin etrafını dolanıyor mu? |
| 4 | `review-photos/` (varsa) | yorum fotoğrafı | Anasayfa yorumlarda gözüküyor mu? |
| 5 | `mail_outbox` tablosu | 4 mail kaydı | Sipariş alındı + admin notify + prova hazır + kargo |
| 6 | `mail_suppressions` | (boş) | Bounce/complaint yok, sağlıklı akış |
| 7 | `/admin/mail-health` | 4 sent, 4 delivered | Webhook eventleri geldi mi |

---

## 🚨 Test sırasında dikkat

- **PayTR test kartı kullan** — gerçek ödeme alma
- **Gerçek müşteri maili kullanma** — Sefa'nın test mail'i (pimetiket@gmail.com veya sefayakut111+test@gmail.com gibi alias)
- **Pikachu telifli** — sadece iç test, müşteriye gösterme
- **Test sonrası temizlik:** PE-XXXX siparişini `/admin/siparisler/PE-XXXX` → "İptal/sil" ile kaldır

---

## 📂 İlerideki test materyalleri (placeholder)

- [ ] `vektor-logo.svg` — vektör akışı test (cutline mode: vector)
- [ ] `dusuk-cozunurluk.jpg` (72 DPI) — AI QC fail edip qc_rejected mail tetiği
- [ ] `dev-psd.psd` (>25MB) — Storage limit aşma testi
- [ ] `dupliquate.png` (aynı SHA-256) — duplicate detection testi

---

**İlgili dokümanlar:** `DOSYA-AKISI.md` (storage map), `SIPARIS-AKISI-SNAPSHOT.md` (müşteri yolculuğu)
