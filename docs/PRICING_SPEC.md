# Pim Etiket — Sticker Fiyatlama Modülü Kanonik Spesifikasyon

**Yazar**: Sefa Yakut
**Tarih**: 2026-05-09
**Sürüm**: v0.3 (sticker-fiyatlama.html ile uyumlu)
**Durum**: KANONİK REFERANS — bu doküman pricing motorunun gerçeğidir

---

## Amaç

Sticker üretiminin fiyatlandırmasını uçtan uca otomatik yapan modül. Operatörün işi:

1. Müşterinin sticker boyut + adet bilgisini gir
2. Algoritma tabaka, rulo, fire, maliyet, fiyat hesaplar
3. Sepete ekle, fasoncuya iş emri PDF'i bas

**Kalite öncelikli, eksik üretim olmaz, fazlası bizdedir.**

---

## 1. Üretim Modeli — İki Mod

Sticker boyutuna göre algoritma otomatik karar verir:

### Mod A — Küçük Tabaka (varsayılan)

- Sticker ≤ 230×310 mm (yani 23×31 cm)
- Standart tabaka 23×31 cm sabit (operatör güveni için standardizasyon)
- 24×32 cm zarfa 1'er cm marjla sığar
- Kullanıcı kesim tipini seçer:
  - **Tabaka modu** → 6 mm gap (yarım kesim, müşteri sticker'ları ayırarak çıkarır)
  - **Die-cut modu** → 50 mm gap (her sticker ayrı kesilmiş, hazır)

### Mod B — Büyük Tabaka (otomatik geçiş)

- Sticker > 230×310 mm ama ≤ 400×650 mm (40×65 cm)
- Tabaka 40×65 cm'e zorla genişler
- Kesim tipi otomatik die-cut'a geçer (kullanıcı tabaka seçse bile)
- Zarfa sığmaz → büyük koli paketleme, paketleme maliyeti 2×

### Red — Sınır Aşımı

- Sticker > 400×650 mm
- Mesaj: "Bu boyut sticker servisinin sınırlarını aşıyor. Büyük etiket servisi yakında açılacak."

---

## 2. Tabaka Algoritması

**Standardizasyon önceliği**: tabaka boyutu sabit (23×31 küçük, 40×65 büyük). Sticker bu tabaka içine grid olarak yerleşir:

- `cols × rows` kombinasyonu denenir (her iki rotasyonla)
- En çok adet sığan kombinasyon seçilir
- Tabaka başına `perSheet` adet sticker
- Tabaka sayısı: `sheetsNeeded = ⌈producedQty / perSheet⌉`
- **Dengeli dağıtım**: birden çok tabaka gerekirse stickerlar eşit dağıtılır (5 tabaka × 18'er adet, 4×20+1×10 yerine)

**Tolerans**: %3 sabit. Üretim adedi müşteri sipariş adedinden en fazla %3 fazla olabilir. Aşılırsa kabul edilmez. Fazla üretim müşteriye hediye.

---

## 3. Rulo Plan Optimizasyonu

Rulo (baskı malzemesi rulosu) fiziksel sınırları:

- **En**: 250–600 mm dinamik (algoritma seçer)
- **Boy**: 1520 mm sabit (ya da daha az, son rulo kısmen kullanılır)
- **Kesim markası**: sağ + sol kenarda 40+40 mm
- **Plotter başlangıcı**: sol başta 50 mm

**Algoritma fire avcısı**:

```
Her olası cols (1, 2, 3...) için:
  rolloEni = cols × tabakaW + 80 mm (kesim markası)

Her seçenek için toplam alan hesapla:
  totalArea = rulo eni × kullanılan boy

En küçük alanı seç → MİNİMUM FİRE
```

**Pratik etki**: az adet işte rulo dar (örn. 310 mm), çok adet işte geniş (540 mm). Eski sabit 600 mm modeline göre %30-50 fire tasarrufu.

---

## 4. Maliyet Hesabı — 3 Katman

### ① Üretim

Mod toggle ile seçilir:

- **Fason mod**: tek girdi, m² × TL/m² (varsayılan 120 TL/m²)
- **Kendi üretim mod**: 6 alt kalem
  - Kağıt/Folio (45 TL/m²)
  - Mürekkep (25 TL/m²)
  - Kaplama (15 TL/m²)
  - İşçilik (35 TL/m²)
  - Genel gider (15 TL/m²)
  - Amortisman (10 TL/m²)

Hepsi `totalM2 × oran` olarak hesaplanır. **m² hesabına tüm fireli alanlar dahil** (kesim markası, başlangıç boşluğu, sheet içi boşluk, ekstra hava). Bu standart fason muhasebesidir.

### ② Operasyon

- Hazırlık: 50 TL tek seferlik
- Paketleme: 15 TL × zarf sayısı (büyük tabakada 30 TL × koli)
- Kargo: 80 TL yurtiçi (büyük tabakada desi/m³)
- İşlem ücreti: %2.5 (ödeme komisyonu karşılama)

### ③ Kar & Vergi

- Kar marjı: %75 (üretim+operasyon üstüne)
- Tier çarpanı (aşağıda detayda)
- KDV: %20

### Hesap akışı

```
baseCost = ① + ②
+ kar (×%75)
+ işlem ücreti (×%2.5)
= preTierSubtotal
× tier çarpanı  ← adet kademesi
= subtotal
+ KDV
= toplam müşteri fiyatı
```

---

## 5. Adet Kademesi (Tier Sistemi)

6 sabit tier, butonlarla seçilir (serbest input yok):

| Adet | Çarpan | Etki |
|---|---|---|
| 25 | 1.30× | +%30 zam |
| 50 | 1.20× | +%20 zam |
| 100 | 1.10× | +%10 zam |
| 250 | 1.00× | referans |
| 500 | 0.90× | −%10 indirim |
| 1000 | 0.80× | −%20 indirim |

**250 adet referans**, üstü indirim, altı zam. Çarpan KDV öncesi subtotal'a uygulanır, ardından KDV eklenir.

---

## 6. Sepet Sistemi + Grup İndirimi

### Sepet

- Operatör hesaplama yapar → "Sepete Ekle" → Tasarım N olarak listeye eklenir
- Sepet localStorage'da kalıcı
- Her satır: tasarım adı, boyut, adet, kesim, tier rozeti, grup rozeti, fiyat, sil butonu

### Aynı Boyut Grubu İndirimi

Sepetteki **aynı boyutta (W×H)** birden çok tasarım varsa hepsine ek indirim:

| Aynı boyutta tasarım | Grup indirimi |
|---|---|
| 1 (yalnız) | 0 |
| 2 | −%3 |
| 3–5 | −%5 |
| 6–9 | −%8 |
| 10+ | −%10 (max, daha artmaz) |

**Mantık**: aynı boyut tasarımlar plate kalibrasyonu paylaşır, rulo planı birleştirilebilir, fire azalır — tasarrufun bir kısmı müşteriye yansır.

**Farklı boyut grupları ayrı çalışır**:

```
Sepet:
├── 50×50 grubu — 6 tasarım → −%8 (her birine)
├── 70×70 grubu — 3 tasarım → −%5
├── 100×100 grubu — 2 tasarım → −%3
└── 25×80 grubu — 1 tasarım → 0
```

---

## 7. Lot Numarası

- 6 hane sabit format: `A000001`, `A000002`, …
- **A serisi = sticker, B serisi = etiket** (ileride)
- Ardışık artar, yıl reset yok
- Header'da bir sonraki lot numarası rozet olarak görünür
- PDF basıldığında lot otomatik artar ve istatistik kaydına düşer

---

## 8. İstatistik Kayıt

Her PDF üretimiyle bir kayıt oluşur. Toplanan veriler:

- Lot, tarih, ürün tipi
- Boyut, adet, üretim adet, kesim
- Tabaka sayısı, rulo sayısı, m², fire
- Üretim maliyeti, operasyon maliyeti, kar, satış toplamı

### Modal panel agregatları (📊 buton)

- Toplam üretilen sticker (örn. "1.043.521 adet")
- Toplam ciro + kar
- Toplam baskı m² + ortalama fire
- Mod dağılımı (Fason vs Üretim)
- En popüler boyutlar (top 5)
- Son hesaplamalar (lot numaralarıyla)

Production'a geçince bu yapı PostgreSQL şemasına direkt mapping olur.

---

## 9. PDF İş Emri (Fasoncu için)

🟢 **İş Emri PDF** butonu 3 sayfalık profesyonel PDF üretir:

### Sayfa 1 — İş Künyesi & Teknik Özellikler

- Pim Etiket başlık + lot rozeti
- Tarih, mod, kesim tipi, sipariş+üretim adet, termin
- Sticker boyutu, gap, tabaka boyutu, kapasite
- Tabaka sayısı, rulo sayısı (dinamik en + tasarruf bilgisi)
- Toplam m², fire oranı

### Sayfa 2 — Üretim Planı (Görsel)

- Rulo planı ölçekli çizim
- Dolu tabakalar mercan çerçeveli, T1/T2 etiketli, içlerinde adet
- Çoklu rulo varsa "+ X rulo aynı plan ile" bilgisi
- Tek tabaka detay çizimi:
  - Tabaka modu: zarf+kesim iç içe
  - Die-cut modu: sadece kesim

### Sayfa 3 — Maliyet Detayı + Onay

- ① Üretim kalemleri (formüllerle) → ara toplam
- ② Operasyon kalemleri → ara toplam
- Toplam Maliyet (lacivert blok)
- Kar / İşlem ücreti / Tier çarpanı / KDV
- Müşteri Toplam Fiyatı (mercan blok)
- Operatör imza alanı

PDF dosya adı: `pim-etiket-A000001.pdf`

---

## 10. UI Yapısı (Mevcut Durum)

```
┌─ Header ────────────────────────────────────────┐
│ pim etiket logo  ·  başlık  ·  📊 İstatistik   │
│                                  📄 İş Emri PDF │
└──────────────────────────────────────────────────┘

┌─ Sol Panel ──────────────┐  ┌─ Sağ Panel ──────────┐
│ Fason / Üretim toggle    │  │ ANLIK FİYAT          │
│ Tabaka / Die-cut toggle  │  │ (büyük rakam)        │
│ Genişlik × Yükseklik     │  │ Birim fiyat          │
│ Adet Kademesi (6 buton)  │  │ Tabaka önizleme SVG  │
│ ① Üretim alanları        │  │ Stat kartları:       │
│ ② Operasyon alanları     │  │  • Tabaka/adet       │
│ ③ Kar & Vergi            │  │  • Toplam tabaka     │
└──────────────────────────┘  │  • m²                │
                              │  • Toplam rulo       │
                              │ Fire % rozeti        │
                              └──────────────────────┘

┌─ Rulo Üretim Planı (full width) ────────────────┐
│ Dinamik rulo görseli, kesim markaları, tabakalar│
│ Stat: Rulo / Tabaka/Rulo / Verimlilik           │
└──────────────────────────────────────────────────┘

┌─ Tabaka detayı ──────────┐  ┌─ Maliyet detayı ──────┐
│ Zarf+kesim iç içe görsel │  │ ① Üretim satırları    │
│ Stickerlar dolu+boş      │  │ ② Operasyon satırları │
│ Boşluk göstergesi        │  │ ③ Kar+Tier+KDV        │
└──────────────────────────┘  │ Müşteri Toplam        │
                              └────────────────────────┘

┌─ 🛒 Sepet (full width) ─────────────────────────┐
│ Tasarım 1, 2, 3...  +  Sepete Ekle butonu       │
│ Her satır: boyut, adet, tier, grup, fiyat       │
│ Sepet özeti: ara toplam → grup indirimleri      │
│              → GENEL TOPLAM (mercan)             │
└──────────────────────────────────────────────────┘
```

---

## 11. Dosya Yapısı

- Tek HTML dosyası (`sticker-fiyatlama.html`, ~130 KB)
- HTML + CSS + JavaScript hepsi tek dosyada
- Dış bağımlılık: Google Fonts, jsPDF (CDN), html2canvas (CDN)
- localStorage ile lot sayacı ve istatistik kayıt
- Tarayıcıda doğrudan açılır, kurulum yok

### Production'a geçince:

- **Backend**: Medusa.js v2 (PostgreSQL, TypeScript)
- **Frontend**: Next.js 14 + Tailwind + Framer Motion
- **AI**: OpenAI GPT-4o (Pim agent için karar verildi)
- **TR entegrasyonları**: Iyzico/ParamPOS, Foriba e-Fatura, kargo API'leri, SMS

---

## 12. Karar Verilen Kurallar (özet)

| Konu | Karar |
|---|---|
| Tabaka standardı | 23×31 cm (küçük) sabit |
| Tabaka üst sınır | 23×31 → otomatik 40×65'e geçer |
| Üretim üst sınır | 40×65 → red, "büyük etiket yakında" |
| Rulo eni | 250-600 mm dinamik |
| Kesim markası | sağ + sol 40 mm |
| Plotter başlangıcı | sol 50 mm |
| Min adet | 25 (tier sistemi) |
| Max adet | 1000 (tek tasarım için) |
| Tolerans | %3 sabit (eksik olmaz, fazla olabilir) |
| Adet referansı | 250 |
| Kar marjı | %75 varsayılan |
| KDV | %20 |
| Grup indirim max | %10 (10+ tasarım) |
| Fire faturası | dahil (m² hesabında her şey) |
| Lot formatı | A000001 (6 hane, **A=sticker, B=etiket**) |

---

## 13. Henüz Yapılmadı (sıradaki adaylar)

1. **PDF'i sepet-bazlı yapma** — şu an PDF tek tasarım için, sepetin tamamı için "toplu iş emri" üretmesi
2. **Müşteri-yüzü versiyonu** — müşteriye gösterilecek temiz UI (fire, m², tabaka detayı görünmez)
3. **Etiket modu (rulo etiket)** — sticker'dan ayrı kalkülatör, min 1000 adet, sıcak yaldız, kaplama vs.
4. **Malzeme/kaplama seçici** — opak folyo, holografik, simli, şeffaf — her birinin farklı m² fiyatı
5. **Operatör onay akışı** — dosya yükleme, AI ön-kontrol, 3 gün timer, cüzdan iadesi
6. **İstatistik dashboard'u detaylandırma** — aylık ciro grafiği, malzeme bazında kullanım, müşteri segmentasyonu
