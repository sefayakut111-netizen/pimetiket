Sticker fiyat yapısında büyük değişiklik yapılacak. Aşağıdaki adımları sırayla uygula. Her adım sonrası `npx tsc --noEmit` + commit.

---

## ADIM 1 — Type Değişiklikleri

### `src/lib/pricing-config-types.ts`

**MaterialItem:** Alış + satış çift fiyat ekle:
```typescript
export interface MaterialItem {
  id: string;
  name: string;
  // Alış fiyatı (partner/maliyet)
  m2_cost_try?: number;        // mevcut — bu artık ALIŞ fiyatı
  sheet_cost_try?: number;     // mevcut — bu artık ALIŞ fiyatı
  // Satış fiyatı (müşteriye)
  m2_sell_try?: number;        // YENİ — müşteriye satış ₺/m²
  sheet_sell_try?: number;     // YENİ — müşteriye satış ₺/tabaka
  desc?: string;
  competitor_ref?: string;
  active?: boolean;
}
```

**OptionItem:** Maliyet + satış çift yüzde ekle:
```typescript
export interface OptionItem {
  id: string;
  name: string;
  pct_add: number;             // mevcut — bu artık MÜŞTERİ SATIŞ yüzdesi
  pct_cost?: number;           // YENİ — maliyet/alış yüzdesi (opsiyonel, yoksa pct_add kullanılır)
  desc?: string;
}
```

**OperationConfig:** Kâr marjı ve kargo kaldır:
```typescript
export interface OperationConfig {
  enabled?: boolean;
  setup: number;               // KALACAK
  packaging_per_unit: number;  // KALACAK
  // cargo: number;            // KALDIRILDI — ana fiyatta zaten var
  fee_pct: number;             // KALACAK (PSP komisyon)
}
```

**ProfileConfig:** margin kaldır:
```typescript
export interface ProfileConfig {
  pricing_mode?: PricingMode;
  materials: MaterialItem[];
  options: Record<string, OptionGroup>;
  tiers: TierConfig[];
  operation: OperationConfig;
  // margin: PercentConfig;    // KALDIRILDI — kâr marjı artık alış/satış farkından hesaplanır
  vat: PercentConfig;
}
```

**FALLBACK sabitleri güncelle:** Her fallback config'te:
- `operation.cargo` kaldır
- `margin` kaldır
- Malzemelere `m2_sell_try` / `sheet_sell_try` ekle (alış × 1.5 gibi varsayılan)
- Seçeneklere `pct_cost` ekle (pct_add'ın yarısı gibi varsayılan)

Örnek:
```typescript
materials: [
  { id: "vinil", name: "Vinil", m2_cost_try: 500, m2_sell_try: 750, desc: "..." },
  { id: "transparan", name: "Transparan", m2_cost_try: 700, m2_sell_try: 1050, desc: "..." },
  ...
],
operation: { setup: 50, packaging_per_unit: 0.01, fee_pct: 2.5 },
// margin yok
vat: { pct: 20 },
```

---

## ADIM 2 — Admin Fiyat Sayfası UI Güncelle

### `src/app/admin/fiyatlar/page.tsx`

**Malzeme kartlarında çift fiyat göster:**
Her malzeme satırında mevcut tek fiyat input yerine 2 input yan yana:
```
MALZEME ADI         ALIŞ (₺/m²)    SATIŞ (₺/m²)    AÇIKLAMA
Vinil               [500]           [750]            Standart parlak vinil
Transparan          [700]           [1050]           Şeffaf...
```

Input'lar:
- Alış: `m2_cost_try` (veya `sheet_cost_try`)
- Satış: `m2_sell_try` (veya `sheet_sell_try`)
- Kâr marjı otomatik hesaplansın ve küçük yazıyla gösterilsin: `%50 kâr` gibi

**Seçenek kartlarında çift yüzde göster:**
```
SEÇENEK ADI     MALİYET (%)    SATIŞ (%)    AÇIKLAMA
Parlak          [0]            [0]
Mat             [5]            [10]
```

**Operasyon bölümü:**
- Kargo (₺) alanını KALDIR
- Kâr marjı (%) alanını KALDIR
- Kalan: Setup (₺) + Paketleme (₺/adet) + Komisyon (%)

**Canlı Simülasyon (sağ panel):**
Maliyet kırılımını güncelle:
```
Malzeme alış:     XXX ₺
Malzeme satış:    XXX ₺
Kâr (malzeme):    XXX ₺ (%XX)
Seçenek maliyeti: XXX ₺
Seçenek satış:    XXX ₺
Setup:            XX ₺
Paketleme:        XX ₺
PSP komisyon:     XX ₺
---
Ara toplam:       XXX ₺
KDV (%20):        XXX ₺
Müşteri toplam:   XXX ₺
```

---

## ADIM 3 — Fiyat Hesaplama Motoru Güncelle

Aşağıdaki dosyaları kontrol et ve güncelle:

### `src/lib/pricing-engine/cost.ts`
- `m2_cost_try` yerine `m2_sell_try` kullan (müşteri fiyatı)
- Maliyet hesabında `m2_cost_try` kullan (admin rapor)
- `operation.cargo` referanslarını kaldır
- `margin.pct` referanslarını kaldır

### `src/lib/sticker-customer-pricing.ts`
- Müşteri fiyatı `m2_sell_try` üzerinden hesaplansın
- Kâr marjı artık type'ta yok — alış/satış farkı otomatik

### `src/lib/customer-pricing-from-config.ts`
- `margin` referanslarını kaldır
- Satış fiyatı `m2_sell_try` / `sheet_sell_try` üzerinden

### `src/lib/pricing-calc.ts`
- `calculatePrice` fonksiyonunda margin ve cargo kaldır

### `src/lib/pricing-diff.ts`
- Kaldırılan alanlar için diff kontrolünü güncelle
- Yeni alanlar (m2_sell_try, pct_cost) için diff ekle

---

## ADIM 4 — Geriye Uyumluluk

Mevcut kayıtlı config'lerde `margin`, `cargo`, `m2_sell_try` olmayabilir. Fallback:
- `m2_sell_try` yoksa → `m2_cost_try * 1.5` kullan (varsayılan %50 kâr)
- `sheet_sell_try` yoksa → `sheet_cost_try * 1.5` kullan
- `pct_cost` yoksa → `pct_add * 0.5` kullan
- `margin` yoksa → görmezden gel (artık kullanılmıyor)
- `operation.cargo` yoksa → görmezden gel

---

## ADIM 5 — Müşteri Tarafı Kontrol

Sticker konfigüratör sayfasını test et:
1. `/sticker/yapilandir` aç
2. Malzeme seç → fiyat hesaplanıyor mu?
3. Finiş seç → yüzde doğru uygulanıyor mu?
4. Adet değiştir → tier çarpan doğru mu?
5. Toplam fiyat NaN veya undefined olmuyor mu?
6. Admin fiyat yönetiminde değişiklik yap → canlı simülasyon doğru mu?

---

## ADIM 6 — pricing-diff Güncelle

`src/lib/pricing-diff.ts` dosyasında:
- `margin` diff kontrolünü kaldır
- `operation.cargo` diff kontrolünü kaldır
- Yeni alanlar için diff ekle:
  - `m2_sell_try` vs `m2_cost_try` (malzeme satış fiyatı)
  - `pct_cost` (seçenek maliyet yüzdesi)

---

## ADIM 7 — Etiket Tabaka İçin de Aynı Yapı

Etiket tabaka (`etiket_tabaka` scope) için de sticker ile aynı değişiklikleri uygula:

**Malzemeler:** Alış (`sheet_cost_try`) + Satış (`sheet_sell_try`) çift fiyat
```typescript
// FALLBACK_ETIKET_TABAKA_CONFIG:
materials: [
  { id: "kuse",  name: "Kuşe Etiket",    sheet_cost_try: 22, sheet_sell_try: 33, desc: "..." },
  { id: "kraft", name: "Kraft Etiket",   sheet_cost_try: 20, sheet_sell_try: 30, desc: "..." },
  { id: "beyaz", name: "Opak PP Etiket", sheet_cost_try: 27, sheet_sell_try: 40, desc: "..." },
],
```

**Seçenekler (Kaplama):** Maliyet % + Satış % çift yüzde
```typescript
items: [
  { id: "yok",    name: "Kaplamasız",     pct_add: 0,  pct_cost: 0 },
  { id: "mat",    name: "Mat selefon",    pct_add: 15, pct_cost: 8 },
  { id: "parlak", name: "Parlak selefon", pct_add: 15, pct_cost: 8 },
],
```

**Operasyon:** Sticker ile aynı — kâr marjı ve kargo kaldırılacak:
```typescript
operation: { setup: 60, packaging_per_unit: 0.02, fee_pct: 2.5 },
// margin YOK
vat: { pct: 20 },
```

**Admin UI:** `scope=etiket_tabaka` seçildiğinde de çift fiyat göster (alış/satış malzeme, maliyet/satış seçenek yüzdesi).

**Fiyat hesaplama:** `src/lib/etiket-customer-pricing.ts` ve `src/lib/pricing-engine/etiket-pricing.ts` dosyalarında da:
- Müşteri fiyatı `sheet_sell_try` üzerinden
- Maliyet `sheet_cost_try` üzerinden
- `margin` referanslarını kaldır

**`isStickerDualPriceScope` fonksiyonu adını güncelle** → `isDualPriceScope` yap ve etiket_tabaka'yı da dahil et:
```typescript
export function isDualPriceScope(scope?: ScopeName): boolean {
  return scope === "sticker" || scope === "etiket_tabaka";
}
```

---

## ÖNEMLİ KURALLAR

- Mevcut müşteri siparişlerini BOZMA — geriye uyumluluk şart
- `npx tsc --noEmit` her adım sonrası 0 hata olmalı
- Etiket rulo (`etiket_rulo`) tarafına bu değişiklikte DOKUNMA — pricebook modu farklı çalışıyor
- Commit prefix: `refactor(pricing):`
