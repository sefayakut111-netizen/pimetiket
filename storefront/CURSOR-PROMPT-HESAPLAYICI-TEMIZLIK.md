`src/components/admin/pricing/StickerCalculator.tsx` dosyasını oku ve fiyat yapısı değişikliğine göre güncelle.

## Kaldırılacak Alanlar

### 1. Kargo (cargo)
- State: `cargo` (satır ~129)
- Input: "Kargo" field (satır ~632-636)
- `operation.cargo` hesaplamaya girmesin
- DEFAULTS'tan kaldır

### 2. Kâr Marjı (marginPct)
- State: `marginPct` (satır ~133)
- Input: "Kar Marjı (markup)" field (satır ~655-659)
- Hesaplamadan kaldır — artık alış/satış farkından otomatik

### 3. Min Markup Floor (minMarkupFraction)
- State: `minMarkupFraction` (satır ~137-138)
- Input: "Min Markup Floor" field (satır ~671-675)
- Margin warning sistemi kaldır (satır ~1121-1143)

### 4. Overhead kontrolü
- `overhead` state'i kontrol et — ne işe yarıyor?
- Eğer bu da margin/kâr ile ilgiliyse kaldır
- Eğer bağımsız bir maliyet kalemiyse (SaaS recovery gibi) tut

## Güncellenecek Alanlar

### 5. Fiyat hesaplama çağrısı
`quoteSticker` veya `calculatePrice` çağrısında:
- `operation.cargo` → kaldır
- `margin.marginPct` → kaldır
- `margin.minMarkupFraction` → kaldır

### 6. Sağ panel maliyet kırılımı
Ekran görüntüsünde:
```
MALİYET    NET KAR (SEFA)    PSP KOMİSYON    KDV
207 ₺      227 ₺             11 ₺            89 ₺
           %110 markup
```

Bunu güncelle:
```
MALİYET (ALIŞ)    SATIŞ FİYATI    KÂR       PSP KOMİSYON    KDV
XXX ₺             XXX ₺           XXX ₺     XX ₺            XX ₺
                                  %XX kâr
```

Kâr artık margin input'tan değil, config'teki alış (m2_cost_try) vs satış (m2_sell_try) farkından hesaplansın.

### 7. Site Fiyatı (Live Config) bölümü
Altta "FASON PARTNER MALİYETİ" ve "MÜŞTERİ FİYATI" kartları var. Bunlar live config'ten hesaplıyor — `m2_sell_try` kullanarak müşteri fiyatı göstersin, `m2_cost_try` ile maliyet göstersin.

### 8. ProfileInputSnapshot güncelle
`src/lib/pricing-profiles.ts` dosyasında:
- `cargo` → kaldır
- `marginPct` → kaldır
- `minMarkupFraction` → kaldır
- `getDefaultInput()` güncelle

### 9. calculatePrice güncelle
`src/lib/pricing-calc.ts` dosyasında margin ve cargo referanslarını kaldır.

### 10. Reset fonksiyonu
`handleReset` fonksiyonunda kaldırılan alanları temizle.

## Test
1. Hesaplayıcı açılıyor mu? (NaN yok)
2. Boyut + malzeme + tier seçince fiyat hesaplanıyor mu?
3. Kaldırılan alanlar UI'da görünmüyor mu?
4. Site Fiyatı bölümü doğru mu?
5. Maliyet kırılımı doğru mu?

## BAĞLAM — 2 Motor Var, İkisi de Kalacak

Bu hesaplayıcıda 2 farklı hesaplama motoru yan yana çalışıyor:

**SOL — Operatör Maliyet Simülasyonu (`quoteSticker`)**
Üretim maliyetini hesaplıyor: fason rate VEYA kendi üretim kalemleri (kağıt, mürekkep, kaplama, işçilik, overhead, amortisman). Bu admin'in "bu işi üretmek bize kaça mal olur?" sorusunu cevaplıyor. Bu kısımda:
- Fason rate → KALACAK (fason modu)
- Üretim kalemleri (paper, ink, coating, labor, depreciation) → KALACAK (üretim modu)
- Overhead → KALACAK (genel gider)
- Cargo → KALDIRILACAK (fiyat yapısından çıktı)
- marginPct → KALDIRILACAK (kâr artık alış/satış farkından)
- minMarkupFraction → KALDIRILACAK

**SAĞ — Site Fiyatı (`calculatePrice` + live config)**
Müşterinin göreceği fiyatı hesaplıyor: Fiyat Yönetimi config'indeki alış/satış fiyatları + tier + seçenekler + KDV. Bu kısım dual-price yapısını zaten kullanıyor.

**İkisi arasındaki karşılaştırma:**
Admin, sol taraftaki maliyet ile sağ taraftaki müşteri fiyatını karşılaştırarak kârlılığı görür. Bu yüzden ikisi de kalmalı.

## EK — quoteSticker operation/margin temizliği

`quoteSticker` çağrısında (satır ~191-210):
```typescript
// ESKİ:
operation: { setup: 0, packaging: 0, cargo: 0, feePct: 0 },
margin: { marginPct: 0, vatPct: 0, minMarkupFraction: 0 },

// YENİ — cargo ve margin parametreleri yok:
operation: { setup: 0, packaging: 0, feePct: 0 },
```

`quoteSticker` fonksiyonunun (`src/lib/pricing-engine/index.ts`) parametrelerini de güncelle — `cargo` ve `margin` kaldır.

Her fix sonrası `npx tsc --noEmit` + commit (`refactor(calculator):` prefix).
