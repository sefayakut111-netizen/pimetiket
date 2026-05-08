# Sticker Pricing Module — Analiz ve Entegrasyon Planı

**Tarih**: 2026-05-09
**Kaynak**: `C:\Users\msı\Desktop\sticker-fiyatlama.html` (4315 satır)
**Sürüm**: v0.3
**Durum**: Block A — Sefa modülü atadı, lokal Claude analizini yaptı

---

## 1. Modülün ne yaptığı (yüksekten bakış)

Sefa'nın yazdığı modül **plotter bazlı sticker fiyatlandırma motoru**. Üç ana iş yapıyor:

1. **Geometrik optimizasyon**: Sticker boyutuna göre (a) küçük tabaka 23×31 cm'e mi sığar, (b) büyük tabaka 40×65 cm'e mi gerek, (c) hiçbirine sığmazsa "büyük etiket servisi" mesajı.
2. **Maliyet hesabı**: Fason mod (m²×rate) veya Kendi üretim mod (kağıt+mürekkep+kaplama+işçilik+overhead+amortisman m²×rate). Üzerine operasyon (hazırlık+paketleme+kargo+%fee), kar marjı, KDV, tier zam/indirim.
3. **Sepet sistemi**: Aynı boyutta birden fazla tasarım ek %3-10 grup indirimi. Lot numarası (A serisi sticker), istatistik tutma, PDF iş emri.

Çok güzel düşünülmüş ve **production-ready mantık** — sadece ortamı değişecek (browser → server side + UI'lar Next.js).

---

## 2. Pricing motorunun matematiksel akışı

```
GİRDİ:
  W, H (mm)            ← sticker boyutu
  Q (adet)             ← müşteri talebi (sticker'da tier butonu)
  cut: tabaka|diecut   ← kesim tipi
  mode: fason|uretim   ← üretim modu

ALGORITMA — STEP 1: Tabaka seçimi (findOptimalSheet)
  Try küçük tabaka (230×310) — her iki rotasyon (W×H ve H×W)
    cols = floor((SHEET_W + gap) / (sticker_w + gap))
    rows = floor((SHEET_H + gap) / (sticker_h + gap))
    perSheet = cols × rows
    gap: tabaka mode 6mm, diecut mode 50mm
  IF küçük tabakaya sığmıyorsa → Büyük tabaka (400×650)
    Aynı algoritma ama gap zorla 50mm (forcedDieCut=true)
  IF büyük tabakaya da sığmıyorsa → RED, "büyük etiket servisi yakında"

  Çıktı: { perSheet, sheetsNeeded=ceil(Q/perSheet), producedQty=sheetsNeeded×perSheet,
           overrun=(producedQty-Q)/Q }
  Tolerans: %3'e kadar overrun OK, hediye olarak müşteriye verilir
            ("Üretim 250, faturalanır 250, +6 hediye")

STEP 2: Rulo planı (computeRollPlan)
  Rulo eni DİNAMİK (250-600mm), boy SABİT 1520mm
  Marjlar: 40mm sağ + 40mm sol kesim markası, 50mm başlangıç plotter boşluğu
  Algoritma her cols=1..maxCols için dener, en az fire üreten kombinasyonu seçer
  
  Çıktı: { rollW (dinamik), rollsNeeded, sheetsPerRoll, totalLengthMm,
           sheetsXPerRoll, sheetsYPerRoll, rollEfficiency }
  totalM2 = rollW × totalLengthMm / 1_000_000

STEP 3: Maliyet (compute)
  productionCost:
    fason: totalM2 × fasonRate
    uretim: totalM2 × (uPaper + uInk + uCoating + uLabor + uOverhead + uDepreciation)
  
  operationCost = opSetup + (opPackaging × envelopeCount) + opCargo
    Not: büyük tabakada paketleme × 2, kargo "desi/m³ hesaplı"
  
  baseCost = productionCost + operationCost
  profit = baseCost × margin%
  subtotalBeforeFee = baseCost + profit
  processingFee = subtotalBeforeFee × opFee%   ← ödeme komisyonu
  preTierSubtotal = subtotalBeforeFee + processingFee
  
STEP 4: Tier ayarı (Adet kademesi)
  tierMult = 25→1.30, 50→1.20, 100→1.10, 250→1.00 (referans),
             500→0.90, 1000→0.80
  subtotal = preTierSubtotal × tierMult
  vatAmount = subtotal × vat%
  total = subtotal + vatAmount
  unitPrice = total / Q

STEP 5: Sepet grup indirimi (CartLevel)
  Aynı boyut (W×H) grubu için ek indirim:
    2 tasarım: −%3
    3+ tasarım: −%5
    6+ tasarım: −%8
    10+ tasarım: −%10 (max)
  Cart total = sum(item.preGroupTotal × (1 - groupDiscountPct))
```

---

## 3. Sabitler ve constraint'ler

| Sabit | Değer | Anlamı |
|---|---|---|
| `ROLL_W_MAX` | 600 mm | Plotter maksimum genişlik |
| `ROLL_W_MIN` | 250 mm | Çalışılabilir minimum |
| `ROLL_L` | 1520 mm | Rulo plan boyu (sabit fiziksel sınır) |
| `ROLL_MARGIN_X` | 40 mm | Sağ + sol kesim markası |
| `ROLL_MARGIN_Y` | 50 mm | Sol başlangıçta plotter boşluğu |
| `SMALL_SHEET_W/H` | 230 × 310 mm | Standart küçük tabaka (24×32 zarfa sığar) |
| `SMALL_ENVELOPE_W/H` | 240 × 320 mm | Müşteriye gönderilen zarf |
| `BIG_SHEET_W/H` | 400 × 650 mm | Büyük tabaka (zorla die-cut) |
| Tolerance | 0.03 (%3) | Adet en fazla %3 aşılabilir |
| Tier kademeler | 25/50/100/250/500/1000 | 250 referans, ±%30/-%20 arası çarpan |
| Grup indirim | 2/3/6/10 → 3/5/8/10 % | Aynı boyut çoklu tasarım |
| Lot prefix | A=sticker, B=etiket | 6 hane, ardışık |

---

## 4. Bizim sisteme entegrasyon planı

### 4.1 Mantıksal ayırım — nereye gider?

| Modülün parçası | Bizim sistemde nereye | Neden |
|---|---|---|
| **Pricing core algoritması** | `medusa/src/modules/pricing-engine/` | Tek source of truth — backend'de hesap |
| **Maliyet sabitleri** (paper, ink, fason rate vb) | Admin UI + DB tablo | Sefa fiyat günceller, müşteri görmez |
| **Geometri optimizasyon** (findOptimalSheet, computeRollPlan) | `medusa/src/modules/pricing-engine/lib/geometry.ts` | Saf fonksiyon, test edilebilir |
| **Sticker calculator UI** | Admin'de `/admin/fiyat-hesapla` (zaten plan'da var) | Sefa içeride kullanır |
| **Customer-facing fiyat** | Storefront `/sticker` configurator'a geçici embedded versiyon | Müşteri tier seçer, anlık fiyat |
| **Sepet grup indirimi** | `medusa/src/modules/pricing-engine/cart-discount.ts` | Cart-level hook |
| **Lot numarası** | DB sequence (A/B prefix) | localStorage uygun değil — tek-makine |
| **İstatistik** | DB tablo `pricing_calculations` | localStorage 500 kayıt yetmez |
| **PDF iş emri** | Backend `/admin/api/work-order/[lot].pdf` | Server-side render |
| **AI QC + email yönlendirme** | Yeni modül `qc-pipeline` (zaten scaffold'da) | Bu pricing değil, ayrı |

### 4.2 Mimari karar — neden hem admin hem storefront?

Sefa'nın açıklamasından çıkan iki katmanlı kullanım:

```
ADMIN (operatör panel):
   ├─ Pricing parametre yönetimi (kağıt fiyatı, fason rate güncelleme)
   ├─ Manuel hesaplama aracı (Sefa "şu boyut şu adet kaça olur?" sorgular)
   ├─ İş emri PDF üretimi
   ├─ İstatistik dashboard'u
   └─ Lot sayacı

STOREFRONT (müşteri):
   ├─ /sticker configurator → sadece SATIŞ fiyatı görür
   ├─ Tier butonları (25/50/100/250/500/1000)
   ├─ Anlık fiyat kartı (KDV dahil + birim fiyat)
   └─ Sepete ekle → grup indirimi otomatik
   
İKİ TARAFIN ORTAK CALL ETTİĞİ:
   POST /api/pricing/quote
     body: { product: 'sticker', W, H, Q, cut, customizations }
     response: { unitPrice, total, vatAmount, breakdown, layout, tolerance, ... }
```

### 4.3 Müşteriye ne göstereceğiz, ne göstermeyeceğiz

Müşteri **görmez**:
- Fason rate (gizli)
- Üretim maliyet detayı (kağıt 45 TL/m² gibi)
- Kar marjı
- Operasyon kalemleri tek tek

Müşteri **görür**:
- Sticker boyutu × adet × tier
- KDV dahil toplam
- Birim fiyat
- Teslim süresi
- "Aynı boyutta 3+ tasarım için %5 indirim" upsell mesajı
- Hediye adet bilgisi ("Üretim 256, faturalanır 250, +6 hediye")

Sefa **görür** (admin'de):
- Tüm cost breakdown
- Maliyet, kar, KDV ayrımı
- Rulo plan görseli
- Tabaka dizgi görseli
- Fire %
- İş emri PDF üretme

### 4.4 Rulo etiket için adaptasyon (Sefa'nın notu)

Modül şu an sadece sticker (tabaka bazlı). Rulo etiket için:

| Sticker (mevcut) | Rulo etiket (yapılacak) |
|---|---|
| Tabaka 23×31 / 40×65 | **Tabaka YOK**, doğrudan rulo |
| `findOptimalSheet` | Atla — direkt rulo |
| `perSheet` hesabı | `perRoll` = ceil(qty / etiketsPerMeter) tarzı |
| `totalM2 = rulo eni × boyu` | Aynı, ama rulo eni etiket eni × N kolon |
| Tabaka cut: tabaka/diecut | **Etikette her zaman die-cut** + sarım yönü 8 varyant |
| Sticker: tek adet | Etiket: 1000 adetten başlar (MOQ) |
| Lot prefix A | **Lot prefix B** |
| Sticker tier 25/50/.../1000 | Etiket tier 1K/2K/5K/10K/20K/50K (zaten configurator'da var) |
| Özelleştirme yok | **Özelleştirme % olarak ekleniyor** (yaldız +%X, soft touch +%Y) |

Rulo modülü **sticker'ı temel alıp** geometri katmanını sadeleştirir. Pricing core (cost+margin+VAT+tier) aynı kalır.

### 4.5 Customization (özelleştirme) entegrasyonu — Sefa'nın notu

Sefa: "özelleştirme seçenekleri ana ürün üzerine % olarak eklenecek"

Bu mevcut etiket configurator'ında zaten var:
```ts
// storefront/src/app/etiket/page.tsx:97-114
MAT_PRICE: kraft 1.6, beyaz 1.4, ultra 2.1, metalik 2.6
COAT_PRICE: mat 0.4, parlak 0.35, soft 0.55, yok 0
CUSTOM_PRICE: yok 0, emboss 0.6, yaldiz 0.9, spotuv 0.5
```

Yeni mantık:
- Malzeme + kaplama = **base m² rate**'i belirler
- Özelleştirme (emboss/yaldız/spotUV) = **% olarak çarpan** (örn yaldız +%30, spotUV +%20)
- Bu sticker'da yok (sticker düz baskı), etikette var

Pricing engine'de:
```
basePerM2 = MATERIALS[m].price + COATINGS[c].price
customMult = 1 + sum(CUSTOMIZATIONS[k].percent for k in selected)
finalPerM2 = basePerM2 × customMult
```

### 4.6 Otomasyon akışı (Sefa'nın notu)

```
[1] Müşteri configurator'da sipariş verir + dosya yükler
       ↓
[2] qc-pipeline → AI dijital onay (Claude Vision veya Gemini)
       ↓
   ┌── PASS (DPI/CMYK/font/bleed OK) ──┐
   │                                    │
   ▼                                    ▼
[3a] AI grafik onayı VERDİ        [3b] AI grafik EKSİKLİK buldu
       │                                │
       ▼                                ▼
[Mail → Baskı birimi]            [Mail → Grafik sorumlusu]
   {ruloBaskıMail|stickerMail}        ↓
   konuya göre                   [Grafik düzeltir + uploads.fix]
                                       ↓
                                   [Mail → Baskı birimi]
```

Bunlar **qc-pipeline + workflow modülü** işi, pricing engine değil. Pricing engine sadece "fiyat" tarafıyla ilgilenir, sipariş akışı **G modülünün sorumluluğu**.

Mail yönlendirme için Resend (Sefa zaten Packanalyz'de kullanıyor) veya benzer.

---

## 5. Veri modeli — yeni tablolar

### 5.1 `pricing_calculations` (mevcut localStorage `pim_calculations` yerine)

```sql
CREATE TABLE pricing_calculations (
  id UUID PRIMARY KEY,
  lot TEXT UNIQUE NOT NULL,           -- A000001, B000001
  product TEXT NOT NULL,               -- 'sticker' | 'etiket'
  customer_id UUID,                    -- nullable, anonim hesap olabilir
  order_id UUID,                       -- siparişe bağlandıysa
  
  -- Geometri
  width_mm INT NOT NULL,
  height_mm INT NOT NULL,
  cut_type TEXT,                       -- 'tabaka' | 'diecut' | NULL (rulo)
  
  -- Adet
  requested_qty INT NOT NULL,
  produced_qty INT NOT NULL,
  overrun_count INT NOT NULL,
  
  -- Üretim modu
  mode TEXT NOT NULL,                  -- 'fason' | 'uretim'
  
  -- Layout
  sheets_needed INT,                   -- sticker only
  rolls_needed INT,
  total_m2 NUMERIC(10,3),
  sticker_area_m2 NUMERIC(10,3),
  waste_pct NUMERIC(5,2),
  layout_metadata JSONB,               -- cols, rows, perSheet, dynamicRollW, etc.
  
  -- Maliyet (gizli, müşteriye gösterilmez)
  production_cost NUMERIC(10,2),
  operation_cost NUMERIC(10,2),
  base_cost NUMERIC(10,2),
  profit NUMERIC(10,2),
  processing_fee NUMERIC(10,2),
  tier_mult NUMERIC(4,2),
  tier_adjustment NUMERIC(10,2),
  
  -- Müşteri-yüzü
  subtotal NUMERIC(10,2),
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),                 -- KDV dahil
  unit_price NUMERIC(10,4),
  
  -- Audit
  pricing_version TEXT NOT NULL,       -- 'v0.3' (modül sürümü)
  parameters_snapshot JSONB,           -- o anki paper/ink/labor değerleri
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON pricing_calculations (customer_id);
CREATE INDEX ON pricing_calculations (order_id);
CREATE INDEX ON pricing_calculations (created_at DESC);
CREATE INDEX ON pricing_calculations (product, width_mm, height_mm); -- repeat order lookup
```

### 5.2 `pricing_parameters` — Sefa'nın admin'de güncellediği değerler

```sql
CREATE TABLE pricing_parameters (
  id UUID PRIMARY KEY,
  scope TEXT NOT NULL,                 -- 'sticker' | 'etiket' | 'global'
  key TEXT NOT NULL,                   -- 'fason_rate', 'paper_rate', 'margin', vs
  value NUMERIC(10,4) NOT NULL,
  unit TEXT,                           -- 'TL/m²' | '%' | 'TL'
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_to TIMESTAMPTZ,            -- nullable, hala geçerliyse NULL
  updated_by TEXT,
  notes TEXT,
  
  UNIQUE (scope, key, effective_from)
);
```

**Kritik**: Geçmiş hesaplamalarda kullanılan parametreleri saklamak için `effective_from/to` aralık. "Bu siparişin fiyatı niye o kadardı?" denince doğru snapshot bulunur.

### 5.3 `pricing_lot_counter` — atomic lot generation

```sql
CREATE TABLE pricing_lot_counter (
  prefix CHAR(1) PRIMARY KEY,          -- 'A', 'B', 'C', ...
  counter BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic increment için PostgreSQL function
CREATE OR REPLACE FUNCTION next_lot(p CHAR(1)) RETURNS TEXT AS $$
DECLARE n BIGINT;
BEGIN
  INSERT INTO pricing_lot_counter (prefix, counter) VALUES (p, 1)
    ON CONFLICT (prefix) DO UPDATE SET counter = pricing_lot_counter.counter + 1, updated_at = NOW()
    RETURNING counter INTO n;
  RETURN p || LPAD(n::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

LocalStorage'dan vazgeçmenin sebebi: race condition (iki kullanıcı aynı anda lot çekemez), tek-makine bağımlılığı, restore gerek.

---

## 6. Önemli mimari noktalar

### 6.1 ⚠️ Tek source of truth — pricing motoru SERVER'da

Şu an HTML'de browser-side hesaplıyor. Bizim sistemde:
- Storefront UI **fiyat ön-izlemesi** (UX için anlık) lokal hesaplayabilir
- Ama **kaydedilen, sepete giren, ödenen** fiyat **HER ZAMAN backend** API'sinden gelir
- Müşteri DevTools açıp `state.tierMult = 0.1` yapamasın

Pattern: **Optimistic UI + server validation**.
```ts
// Client: anlık tahmin (debounced)
const estimate = quickPricingEstimate({W, H, qty, cut});
// Server: kesin hesap (sepete eklerken çağrılır)
POST /api/pricing/quote → kesin fiyat
```

### 6.2 ⚠️ Fiyat değişiminde geçmiş bozulmamalı

Sefa Mart'ta fason rate'i 120 → 140 TL/m² çıkarırsa, **Şubat'ta verilen sipariş hâlâ 120 TL üzerinden faturalanmış olmalı**. Çözüm:

- `pricing_calculations.parameters_snapshot` JSONB → o anki tüm parametreler
- `pricing_parameters` tablosunda effective_from/to ile zaman dilimleri
- Repeat order'da müşteri "tekrar yap" diyince **güncel fiyat üzerinden** quote verilir, ama **geçmiş referans** korunur.

### 6.3 ⚠️ "Tekrar baskı" akışı — Sefa'nın özel istediği

> "geriye dönük ürünlerin fiyat listesi ve baskı verileri tutulacak ki tekrar işler hemen işleme alınabilecek ve iç sistemi rahatlatacak"

Gerekli yapı:
```ts
// Sticker tekrar baskı (Pim "Tekrar baskı" chip'inden):
GET /api/customer/{id}/orders → past orders
GET /api/order/{id}/repeat-quote → güncel fiyatla quote
   → past order'ın tüm config'i (W, H, qty, cut, mode, customizations) yeniden quote'lanır
   → fiyat farkı varsa müşteriye gösterilir ("önceki: 1250 TL, yeni: 1320 TL — kabul ediyor musun?")
   → onaylanırsa cart'a yeni line eklenir
```

Bu Pim Faz 3 (Operatör/Kargocu Pim) ile birlikte gelecek bir feature, çünkü "tekrar baskı" Pim'in chip'i.

### 6.4 ⚠️ Lot numarası — A/B serisi

> "her işin lot numarası olacak rulo etiket A sticker B gibi"

Sefa'nın HTML'inde A=sticker yazıyor, mesajında **A=etiket B=sticker** demiş — **bunu netleştirmemiz gerek** (decision question #1 aşağıda).

Lot ne zaman atanır?
- (a) Sipariş ödenince — tarihsel boşluk olabilir (iptal edilen siparişler delik açar)
- (b) Üretime gönderilince — boşluksuz dizi
- (c) Hesaplama yapılınca (HTML'deki gibi) — denenmiş ama satın alınmamış hesaplar da tüketir

Önerim: **(b)** — sipariş "ödendi → AI QC pass → üretim sırasına eklendi" anında lot çekilir. Önce hesap, sepet, ödeme, QC akışı durumlanır, sonra lot. Bu sıra "atılmış lot" tutar.

### 6.5 ⚠️ İstatistik granularity — kayıt nasıl çekilecek

Sefa: "kaç etiket bastık, ne kadar m² üretim yaptık, ürün özellikleri vs"

Önerilen `pricing_calculations` tablosu zaten her hesabı tutar. Ama **hesap ≠ üretim**. Kullanıcı 50 hesap dener, 1 sipariş verir. İstatistikte ne istiyoruz?

| Metrik | Kaynak |
|---|---|
| Kaç sticker bastık | `pricing_calculations` WHERE order_id IS NOT NULL → SUM(produced_qty) |
| Kaç m² ürettik | aynı tablo → SUM(total_m2) |
| Hangi boyut popüler | GROUP BY (width, height) ORDER BY COUNT |
| Aylık ciro | GROUP BY date_trunc('month', created_at) → SUM(total) |
| Fason vs üretim | GROUP BY mode |
| Fire ortalaması | AVG(waste_pct) |
| Ortalama birim fiyat | AVG(unit_price) |

Mevcut HTML'deki `aggregateStats` fonksiyonu **doğru sorgu listesi** veriyor, sadece SQL'e taşınması lazım.

### 6.6 ⚠️ Customer'a fiyat görünür hale geldikten sonra A/B test

Mevcut storefront'ta `/etiket` ve `/sticker` configurator'ında **kendi hardcoded pricing'i** var. Sefa'nın modülüyle değiştireceğiz. Ama **çok dikkatli geçiş**:

1. Önce Sefa'nın motoru `/admin/fiyat-hesapla` (yeni sayfa) altında çalışsın → Sefa "evet bu doğru" der
2. Sonra `/sticker` configurator backend'e bağlansın
3. Son olarak `/etiket` configurator backend'e bağlansın

### 6.7 ⚠️ Tabaka algoritmasının sticker'a özel doğası

Sticker pricing'inde TABAKA optimizasyonu kalbi var. Etikete geçince:
- Tabaka concept'i YOK (rulo direkt)
- Ama rulo planı VAR (modül zaten yapıyor — `computeRollPlan`)
- Etiket doğrudan rulo planına gider, tabaka adımı by-pass edilir

**Refactor için**: `findOptimalSheet` ve `computeRollPlan` ayrı modüllerde olmalı. Sticker iki adımı sırayla çağırır, etiket sadece ikincisini.

### 6.8 ⚠️ "Büyük etiket servisi yakında" red mesajı

> `if (W > BIG_SHEET_W || H > BIG_SHEET_H) return { ok: false, bigEtiketRedirect: true }`

Bu güzel bir UX — sınır aşılınca müşteriyi dürüstçe söyler, lead capture fırsatı. Belki "müsait olunca beni haberdar et" formu eklenebilir (Pim Tasarımcı bunu sorabilir).

### 6.9 ⚠️ Tier mantığında bir potansiyel bug

Mevcut sticker'da:
```
25 adet → +%30 zam
250 adet → referans (%100)
1000 adet → −%20 indirim
```

Ama kullanıcı 250 talep eder, üretim toleransla 256 yapar (overrun=0.024). Tier 250 olarak kalır. Bu **doğru davranış** — talep edilen üzerinden tier, üretim fizikten gelen overrun.

Etikete geçince adet kademeleri 1K/2K/5K/10K/20K/50K. Mevcut configurator'da var ama yapısı farklı (tierDiscount fonksiyonu, sticker'daki gibi referans+çarpan değil, sürekli aralık):
```js
function tierDiscountForQty(qty) {
  if (qty >= 20000) return 0.78;
  if (qty >= 10000) return 0.84;
  if (qty >= 5000) return 0.9;
  if (qty >= 2000) return 0.96;
  return 1;
}
```

**Karar gerek**: Etiketi de sticker tarzı **kademe-buton** sistemine mi alacağız, yoksa sürekli slider mı kalacak? Sticker buton, etiket slider tutarsız. Önerim: ikisi de buton + opsiyonel slider.

### 6.10 ⚠️ Sepet grup indirimi — etikette de uygulanacak mı?

Mevcut: aynı boyut sticker tasarımı 2+ olunca ek indirim.

Etikette de mantıklı mı? Aynı boyut etiket = aynı kalıp, evet üretim hattında setup tasarrufu var, indirim mantıklı. **Önerim**: aynı %3-10 indirim eğrisini etikete de uygula.

### 6.11 ⚠️ "Cüzdandan ödeyince +%2 indirim" — modülde yok

Mevcut storefront'ta `/cuzdan` sayfası ve PriceCard'da bu indirim yazıyor. Pricing modülünde bunun karşılığı YOK. **Eklemek gerek**:

```ts
const finalTotal = total - (paymentMethod === 'wallet' ? total * 0.02 : 0);
```

Bu **checkout aşamasında** uygulanır, quote aşamasında değil — çünkü ödeme yöntemi seçilince netleşir.

---

## 7. Eksikler / sorulması gerekenler (Sefa'ya)

### 7.1 Soru 1: Lot prefix — A mı B mi sticker?

Sefa'nın HTML'inde `A` sticker olarak hard-coded. Mesajda **"rulo etiket A, sticker B"** yazmış. Çelişki var. Hangisi doğru?

### 7.2 Soru 2: Lot ne zaman atansın?

(a) Hesaplama yapınca (mevcut HTML davranışı)
(b) Sipariş onaylanınca
(c) Üretime gönderilince (önerim)

Müşteri tüm hesaplamaları lot tüketmesin, **sadece sipariş kesinleşince**.

### 7.3 Soru 3: Fason rate, üretim parametre değişikliği yetkisi kim?

Sadece Sefa mı, operatör de mi? Audit log gerekli mi?

### 7.4 Soru 4: Pricing motoru nereye deploy edilecek?

(a) Medusa modülü içinde (mevcut plan)
(b) Ayrı bir mikroservis (overhead)
(c) Edge function (Supabase Edge ile, Packanalyz'de var)

Önerim: (a) — basit kalsın.

### 7.5 Soru 5: Etiket için özelleştirme % oranları

Mevcut etiket configurator'ında `CUSTOM_PRICE` mutlak değer (TL/m²). Sefa "% olarak eklenecek" demiş. Çevirme yapacak mıyız?

Örnek: yaldız şu an `0.9 TL/m²` mutlak. Yeni mantıkta `+%30 base m² fiyatına` olur. Sefa'dan oranlar lazım:
- Emboss: %?
- Yaldız: %?
- Spot UV: %?
- Soft touch: %?
- Mat selefon: %?
- Parlak selefon: %?

### 7.6 Soru 6: Etiket için MOQ sticker'dan farklı

Sticker 25 adetten başlıyor, etiket 1000. Tier butonları storefront'ta zaten var ama Sefa'nın tier mantığı (referans + çarpan) ile ayarlamamız gerek. Hangi tier referans alınsın?

Sticker: 250 referans (%100), altı zam, üstü indirim.
Etiket: 5000? 10000? Hangi tier %100?

### 7.7 Soru 7: Otomasyon — mail yönlendirme adresleri

> "AI grafik onayı verdi → baskı birimi mail
>  AI eksiklik buldu → grafik sorumlusu mail"

Gerekli mail adresleri:
- Rulo etiket baskı birimi: `?@?`
- Sticker baskı birimi: `?@?`
- Grafik sorumlusu: `?@?`
- (genel: `?@?`)

Bu üretim aşamasında belli olur, **şimdi env placeholder yeter**.

### 7.8 Soru 8: AI dijital onay hangi modeli kullanacak?

Pim Etiket'te zaten **OpenAI GPT-4o** kullanıyoruz (Pim agent için). QC için aynısı mı (vision desteği var), yoksa Gemini Flash mi? Maliyet farkı var:
- GPT-4o vision: ~$5 per million tokens
- Gemini 2.5 Flash: ~$0.30 per million

Önerim: **Gemini Flash** — Sefa Packanalyz'da kullanıyor, expertise var, ucuz.

---

## 8. Block A — uygulama planı (önerilen sıra)

Sefa onaylar onaylamaz aşağıdaki sırada gideceğim:

| # | Adım | Süre | Çıktı |
|---|---|---|---|
| A.1 | `medusa/src/modules/pricing-engine/lib/geometry.ts` — `findOptimalSheet`, `computeRollPlan` saf fonksiyon olarak port | 1 saat | TS port + JSDoc |
| A.2 | `medusa/src/modules/pricing-engine/lib/cost.ts` — pricing core (production+operation+margin+VAT+tier) | 1 saat | TS port |
| A.3 | `medusa/src/modules/pricing-engine/lib/cart-discount.ts` — sepet grup indirimi | 30 dk | TS port |
| A.4 | `medusa/src/modules/pricing-engine/models/` — 3 tablo (`PricingCalculation`, `PricingParameter`, `PricingLotCounter`) | 30 dk | Model schema |
| A.5 | `medusa/src/modules/pricing-engine/service.ts` — `quote()`, `saveCalculation()`, `nextLot()` method'ları | 1 saat | Service layer |
| A.6 | `storefront/src/lib/pricing.ts` — shared client lib (UI tahmin için), backend ile **aynı** algoritma | 30 dk | Replace mevcut |
| A.7 | `storefront/src/app/etiket/page.tsx` + `/sticker/page.tsx` — hardcoded fiyatları shared lib'e bağla | 1 saat | Yan etki yok |
| A.8 | Vitest birim testler — 12 senaryo (küçük tabaka, büyük tabaka, red, tier zam, tier indirim, grup indirim, vs) | 1 saat | `pricing.test.ts` |
| A.9 | Build + lint + commit | 30 dk | `feat(pricing): port Sefa's module to medusa pricing-engine` |

**Toplam**: 7-8 saat (1 günlük work).

---

## 9. Sonuç: bu modül entegrasyonu kolay, mantık sağlam

Sefa'nın kodunda **mimari problem yok**. Algoritma deterministic, optimize edilmiş, edge case'ler düşünülmüş (tolerance, büyük tabaka fallback, dynamic rulo eni). Sadece browser ortamından server ortamına taşınacak.

**Risk noktası**: Müşteri-yüzü vs admin-yüzü ayrımı temiz yapılmazsa fiyat manipülasyonu / iç maliyet sızıntısı olur. Plan'da net çizdik.

**Ek değer**: İstatistik + tekrar baskı + lot sistemi modülde zaten var, bunları DB'ye taşıyınca operasyonel bir altyapı kazanıyoruz.

Şimdi 8 sorunun cevabını bekliyorum (en kritik 7.5 — özelleştirme % oranları). Cevaplar gelince A.1'den başlarım.
