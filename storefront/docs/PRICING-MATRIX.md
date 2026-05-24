# Pim Etiket — Partner Pricing Matrix Mimarisi

**Yazıldı:** 23 Mayıs 2026 (Sefa kararı)
**Durum:** ✅ Uygulandı + Faz 4 shadow diff (Migration 093–094, admin UI, müşteri bridge)
**Sahibi:** Sefa Yakut

---

## 1. Hedef (TL;DR)

Üretim partnerlerinden gelen fiyatları temel alan, **anchor noktası + lineer interpolasyon** ile aradaki değerleri otomatik hesaplayan bir fiyat sistemi.

3 ürün tipi için 2 farklı yaklaşım:

| Ürün | Model | Veri kaynağı |
|---|---|---|
| **Etiket Rulo** | Price Book — W×H×qty matris + bilinear interpolasyon | `partner_pricebook_*` tabloları |
| **Etiket Tabaka** | Geometri × tabaka birim fiyatı (matris **yok**) | `pricing_config` `sheet_cost_try` + `pricing-tabaka-geo.ts` |
| **Sticker** | m² × rate × tier (mevcut sistem) | `pricing_config` m² maliyet |

---

## 2. Mevcut sistem (kısa)

Detay: bkz. konuşma transkriptindeki "Pim Etiket Fiyat Motoru — Akademi" özeti.

- **Eski motor** (`src/lib/pricing-engine/*`) — m² × rate × hardcoded malzeme çarpanları
- **Yeni motor** (`src/lib/pricing-calc.ts`) — DB-driven, sheet/area modu
- **Bridge** (`src/lib/customer-pricing-from-config.ts`) — geometri eski, fiyat yeni
- **Maliyet motoru** — `cost.ts`, fason vs üretim modu (üretim modu şu an kullanılmıyor)

**Uyumsuzluk:** Mevcut sistem partner'in 2D fiyat tablosunu temsil edemez. Tek bir `rate` × m² mantığı var.

---

## 3. Yeni model — Model C (2D matris + lineer fill)

### 3.1 Anchor noktaları

**Etiket Rulo:**
- Boyut ekseni: 3×3, 5×5, 7×7, 10×10, 15×15 mm (varsayılan — partner görüşmesinden sonra revize)
- **Adet ekseni: 1.000 / 3.000 / 5.000 / 10.000** ✅ Sefa onaylı (23 May)
- **Min sipariş: 1.000 adet — kati kural.** Altı reddedilir, müşteri sticker'a yönlendirilir.

**Etiket Tabaka:**
- **Matris yok** — 33×45 cm tabaka, kenarlardan 1 cm marj → `calcTabakaSheets()` × `sheet_cost_try`
- Geometri: [`pricing-tabaka-geo.ts`](../src/lib/pricing-tabaka-geo.ts) (tek kaynak)

**Sticker:** Anchor yok (mevcut m² × rate × tier sistemi).

Bu noktalar **konfigüre edilebilir** — admin panelinden eklenip çıkarılır.

### 3.2 Partner matrisi örneği (Etiket Rulo)

```
KUŞE RULO ETİKET (₺/adet) — Sefa onaylı 4 adet kademesi
─────────────────────────────────────────────────
            1.000   3.000   5.000   10.000
   3×3      0.20    0.15    0.12    0.09
   5×5      0.35    0.27    0.22    0.17
   7×7      0.55    0.42    0.35    0.27
  10×10     0.85    0.65    0.55    0.42
  15×15     1.50    1.25    1.10    0.85
```

**20 hücre / malzeme** (5 boyut × 4 adet). Hibrit modelde malzeme başına 1 matris (aşağıda).

### 3.3 Bilinear interpolasyon — örnek hesap

Müşteri **6×6 mm / 4.000 adet** girer:

1. **Boyut:** 5×5 ↔ 7×7 arası → 6×6 ortada (`t_size = 0.5`)
2. **Adet:** 3.000 ↔ 5.000 arası → 4.000 ortada (`t_qty = 0.5`)
3. **4 köşe hücre:**
   ```
                3000ad   5000ad
       5×5      0.27     0.22
       7×7      0.42     0.35
   ```
4. **Önce adet:**
   - 5×5: `0.27 + (0.22-0.27) × 0.5 = 0.245`
   - 7×7: `0.42 + (0.35-0.42) × 0.5 = 0.385`
5. **Sonra boyut:**
   - `0.245 + (0.385-0.245) × 0.5 = 0.315 ₺/adet`
6. **Toplam partner fiyatı:** `0.315 × 4.000 = 1.260 ₺`
7. **+ markup %50:** `1.260 × 1.50 = 1.890 ₺` (matrah)
8. **+ PayTR fee + KDV** → müşteri liste fiyatı

### 3.4 Anchor dışı davranış (clamp policy)

**Etiket Rulo:**

| Durum | Politika |
|---|---|
| Boyut min altı (örn 2×2 < 3×3) | Min anchor (3×3) ile clamp **VEYA** "Teklif iste" formu |
| Boyut max üstü (örn 20×20 > 15×15) | "Teklif iste" formu (zorunlu) |
| **Adet < 1.000** | ❌ **REDDET** — UI: "Rulo etiket için min 1.000 adet. Daha az için Sticker'a bak" + sticker'a yönlendir |
| 1.000 ≤ adet ≤ 10.000 (ara) | Lineer interpolasyon (1.000↔3.000↔5.000↔10.000 anchor'ları) |
| Adet > 10.000 (max üstü) | "Toplu sipariş için teklif iste" formu |

**Önemli:** Rulo etikette **min 1.000 adet kati kural**. Müşteri 500 adet denerse engellenir + sticker önerilir.

---

## 4. Hibrit kaplama modeli

Her **malzeme** kendi matrisini taşır, **kaplama/özelleştirme** üzerine sabit % olarak eklenir.

### 4.1 Matris sayısı

**Etiket Rulo malzemeleri:** kuşe, beyaz (Opak PP), şeffaf, ultra, metalik → **5 matris** × 20 hücre = 100 hücre
**Etiket Tabaka malzemeleri:** kuşe-tabaka, beyaz-tabaka, kraft-tabaka, şeffaf-tabaka → **4 matris** (boyut/adet TBD)

**Toplam (rulo):** 100 hücre. Tabaka için boyut+adet anchor netleşince eklenir.

### 4.2 Kaplama yüzdeleri (matris üzerine eklenir)

| Modifier | Default % | Etki |
|---|---:|---|
| `coating_mat` | +15% | Mat kaplama |
| `coating_glossy` | +15% | Parlak kaplama |
| `coating_soft` | +30% | Soft touch |
| `finish_foil` | +50% | Yaldız |
| `finish_emboss` | +30% | Emboss |
| `finish_spotuv` | +25% | Spot UV |

**Birden fazla seçilirse:** TOPLAMSAL `(1 + Σpct/100)` — eski motorda çarpımsal idi, yeni modelde toplamsal.

Örn: Mat + Yaldız + Spot UV = `1 + 0.15 + 0.50 + 0.25 = 1.90` → +%90 zammet.

(Eski motor: `1.15 × 1.50 × 1.25 = 2.16` → +%116 idi.)

---

## 5. Markup (karlılık) katmanı

**Global tek % — ilk faz**

Admin paneli: `admin_config.markup_pct = 50` (örn). Tüm partner fiyatlarına uygulanır.

```
müşteri_fiyat_ham = partner_fiyat × (1 + kaplama_pct/100) × (1 + markup_pct/100)
```

Üstüne PayTR fee gross-up + KDV (mevcut sistem — değişiklik yok).

**Faz 2'de:** Ürün bazlı veya matris bazlı markup'a genişletilebilir. Şimdilik **global tek %** ile başlanır.

---

## 6. Sticker — m² × rate (değişmez)

Mevcut sistem korunur, geometri motoru aynı:

```
totalM2 = sticker_geometry(qty, w, h, cut_mode)
unit_cost = totalM2 × material_rate × tier_multiplier
+ operationCost (setup + packaging + cargo)
+ markup
+ fee gross-up + KDV
```

**Tier sistemi (`STICKER_TIERS`):** Değişmez.
- 25 → 1.30, 50 → 1.20, 100 → 1.10, **250 → 1.00**, 500 → 0.90, 1000 → 0.80

**Niye matris değil?** Sticker'da boyut serbest, müşteri 50×50 veya 73×42 girer. Matris model her boyutu anchor'a clamp eder — sticker UX bozulur.

---

## 7. DB Schema (Migration 093)

Tablolar: `partner_pricebook_axes`, `partner_pricebook_matrices`, `partner_pricebook_cells`

- Boyut ekseni: `(width_mm, height_mm)` composite — dikdörtgen destekli
- Adet ekseni: `1000 / 3000 / 5000 / 10000`
- Global markup: `site_settings.pricing_markup_pct`

Kod modülleri:

| Dosya | Rol |
|---|---|
| `src/lib/pricing-pricebook.ts` | Public API |
| `src/lib/pricing-pricebook-lookup.ts` | Snapshot lookup |
| `src/lib/pricing-pricebook-interp.ts` | Bilinear + qty interpolation |
| `src/lib/pricing-retail.ts` | Modifier + markup + fee + KDV |
| `src/lib/pricing-pricebook-db.ts` | DB fetch + cache |
| `src/components/admin/pricing/PriceBookPanel.tsx` | Admin grid UI |

Eski Mig 085 önerisi (`partner_pricing_*`) **kullanılmadı** — isimlendirme `pricebook` olarak netleştirildi.

---

## 8. Hesap fonksiyonu spec

**Yeni dosya:** `src/lib/pricing-matrix.ts`

```ts
interface MatrixQuoteInput {
  product_type: 'etiket_rulo' | 'etiket_tabaka';
  material_key: string;       // 'kuse', 'seffaf', ...
  size_mm: number;            // kare için tek değer (max(w,h))
  qty: number;
  modifiers: string[];        // ['coating_mat', 'finish_foil']
}

interface MatrixQuoteResult {
  partner_price_per_unit: number;   // matristen + kaplama
  markup_pct: number;
  unit_price_pre_fee: number;        // + markup
  subtotal: number;                  // + PayTR fee gross-up
  vat_amount: number;
  total: number;
  unit_price: number;                // KDV dahil müşteri fiyatı
  diagnostics: {
    anchors_used: { size: [number, number]; qty: [number, number] };
    interpolation: { t_size: number; t_qty: number };
    cell_corners: [[number, number], [number, number]];
    base_partner_unit: number;
    modifier_pct_total: number;
  };
}

async function getMatrixQuote(input: MatrixQuoteInput): Promise<MatrixQuoteResult>;
```

**İmplementasyon adımları:**

1. `partner_pricing_matrices` SELECT (product_type + material_key)
2. `partner_pricing_axes` SELECT (size + qty listesi)
3. Anchor clamp: size ve qty min/max sınırlandır (clamp policy)
4. 4 köşe `partner_pricing_cells` SELECT
5. Bilinear interpolation
6. Modifiers `partner_pricing_modifiers` SELECT + topla
7. `site_settings.pricing_markup_pct` oku
8. Final formül uygula
9. `diagnostics` payload'u doldur (admin UI'da görünür olsun)

---

## 9. 3 Fazlı uygulama planı

### Faz 1 — Veri + Hesap (1.5 iş günü)

- ✅ Mig 085 yaz (yukarıdaki schema)
- ✅ `getMatrixQuote` fonksiyonu yaz
- ✅ Unit test (örnek matris ile interpolasyon doğrulama)
- ✅ Seed data: bir test malzemesi için anchor + matris doldur

### Faz 2 — Admin UI (1 iş günü)

`/admin/fiyatlar` sayfasına 4 yeni sekme:

1. **Anchor noktaları** — product_type seç → boyut/adet listesini düzenle
2. **Matrisler** — product_type + malzeme seç → 5×5 grid input (tıkla, ₺ gir)
3. **Kaplama yüzdeleri** — sabit % liste düzenleyici
4. **Markup** — global % input (tek alan)

**Diagnostik panel:** Test boyut/adet/malzeme gir → fonksiyonun döndürdüğü `diagnostics` payload'unu göster (hangi 4 hücre kullanıldı, interpolasyon nasıl çalıştı).

### Faz 3 — Müşteri entegrasyonu + Eski motor emeklilik (1 iş günü)

- `customer-pricing-from-config.ts` bridge — etiket için `getMatrixQuote` çağırsın
- `/etiket` konfigüratör — boyut + adet + malzeme + kaplama değişince live preview
- Sticker bridge'i değişmez (mevcut sistem)
- Eski `pricing-engine/etiket-pricing.ts` `@deprecated` işaretle
- 1-2 hafta gözle, kullanılmıyorsa sil

**Toplam:** ~3.5 iş günü.

---

## 10. Açık sorular (Sefa onayı bekliyor)

| Soru | Mevcut varsayım | Karar lazım mı? |
|---|---|---|
| Boyut anchor listesi (kaç nokta?) | 3×3, 5×5, 7×7, 10×10, 15×15 | Partner görüşüldükten sonra netleşecek |
| Adet anchor listesi | 100, 500, 1.000, 5.000, 10.000 | Partner görüşüldükten sonra netleşecek |
| Clamp altı (örn 2×2) politika | "Teklif iste" formu | İlk versiyonda min clamp, sonra "teklif iste" |
| Clamp üstü (örn 20×20) politika | "Teklif iste" formu | ✅ Zorunlu |
| Markup gelecekte ürün bazlı mı? | Faz 1: global, Faz 2+: genişlet | İhtiyaca göre |
| Dikdörtgen boyutlar (5×10)? | Tek değer = max(w, h) ile clamp | Dikkat — alan farkını yansıtmaz, partner ile teyit gerek |

**Önemli:** Dikdörtgen boyut konusu — partner "10×5 = 10×10 yarı fiyatı mı?" gibi sorulara cevap vermesi gerek. Belki **alan bazlı** interpolasyon? (Boyut ekseni `width × height` çarpımı?) Bu noktada partner görüşmesinden sonra revize edilebilir.

---

## 11. Geriye uyumluluk + emeklilik planı

**Eski motor (`pricing-engine/etiket-pricing.ts`)** — Faz 3 sonrası `@deprecated`. 2 hafta canlı sistemde paralel kalır (fallback olarak):

```ts
// customer-pricing-from-config.ts
try {
  return await getMatrixQuote({...});
} catch (err) {
  console.warn('[pricing-matrix] fallback to legacy engine', err);
  return await quoteEtiket({...});  // eski motor
}
```

2 hafta sonra fallback kaldırılır, eski dosyalar silinir. Sticker fonksiyonları KORUNur (zaten matris dışı).

---

## 12. Risk listesi

| Risk | Şiddet | Önlem |
|---|---|---|
| Partner yanlış değer girer (örn 1000 yerine 100₺) | Yüksek | Admin UI uyarı: "Bu hücre komşulardan %500 daha yüksek/düşük" |
| Anchor dışı boyut → müşteri yanılsama | Orta | UI'da "Bu boyut için tahmini fiyat" rozet + diagnostic erişimi |
| Markup çok düşük → zarar | Yüksek | `actualProfit < baseCost × 0.10` uyarısı (mevcut sistem benzeri) |
| 25 hücreyi her malzeme için doldurma sıkıcı | Düşük | "CSV import" özelliği (Faz 2 bonus) |
| Eski siparişlerin fiyat snapshot'ı | Kritik | order_items.unit_price zaten kayıtlı, yeni motor mevcut siparişleri etkilemez |

---

## 13. Sırada ne var?

Bu doc'a göre **Faz 1**'den başlanacak. Sefa "Pricing matrix Faz 1'i başlat" derse:

1. Mig 085 yaz (yukarıdaki schema)
2. `src/lib/pricing-matrix.ts` skeleton + unit test
3. Sefa onayı → "uygula 085"
4. Faz 2'ye geç (admin UI)

---

**Doc revizyon notu:** Bu plan 23 May 2026 Sefa onayıyla netleşti. Partner görüşmelerinden sonra anchor değerleri ve clamp politikası revize edilebilir.
