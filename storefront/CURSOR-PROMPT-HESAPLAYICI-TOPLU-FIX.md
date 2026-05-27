Sticker hesaplayıcı sayfasında 7 sorun var. Sırayla düzelt. Bu session'da sadece Cursor kod yazıyor — Claude dokunmuyor, çakışma riski yok.

Dosyalar: `src/components/admin/pricing/StickerCalculator.tsx` ve `src/app/admin/fiyatlar/page.tsx`

---

## FIX 1 — Fiyat yönetimi üst kısım sadeleştir

`src/app/admin/fiyatlar/page.tsx` dosyasında şunları KALDIR:
- "YÖNETİM" eyebrow etiketi
- "Fiyat Yönetimi" büyük h1 başlık
- Altındaki açıklama paragrafı ("Birim maliyetgir...")
- "Vinil / Opak / Şeffaf / Holografik / Metalik · Finiş seçimi" alttext

KALACAKLAR: Breadcrumb (Dashboard > Fiyat yönetimi), Scope tab'ları (Sticker/Rulo/Tabaka), Fiyat Yönetimi/Hesaplayıcı tab'ları.

---

## FIX 2 — Operatör simülasyonunda büyük fiyat KDV dahil olsun

`StickerCalculator.tsx` — `OperatorCostHero` bileşeninde büyük fiyat `cost.baseCost` (KDV hariç) gösteriyor. Bunu değiştir:

- Büyük fiyat: `cost.total` (KDV dahil) göstersin
- Altında küçük: "KDV hariç: XXX ₺" yazsın

---

## FIX 3 — Site fiyatı önce, simülasyon altta

Sağ paneli yeniden düzenle:

**ÜST (ana, büyük):** Site fiyatı — mevcut config'ten müşterinin göreceği gerçek fiyat. Bu her zaman gösterilsin.

**ALT (ikincil, küçük):** Simülasyon fiyatı — sol panelden fason rate değiştirildiğinde hesaplanan maliyet. Site fiyatıyla farkı göstersin:
```
SİMÜLASYON MALİYETİ: 451 ₺ (KDV dahil)
SİTE SATIŞ FİYATI:   1.329 ₺
FARK:                 +878 ₺ (%195 kâr)
```

---

## FIX 4 — Rulo plan SVG font boyutları büyüt

`src/components/admin/pricing/RollPlanSvg.tsx` dosyasında tüm küçük font-size'ları büyüt:
- `fontSize="13"` → `fontSize="20"`
- `fontSize="14"` → `fontSize="20"`
- `fontSize="16"` → `fontSize="22"`
- `fontSize="18"` → `fontSize="22"`
- `fontSize="20"` → `fontSize="24"`

Özellikle "338×458mm", "40mm KESİM MARKASI", "50mm BAŞLANGIÇ", "120mm boş" gibi yazılar net okunmalı.

---

## FIX 5 — "Maliyet Detayı" satır listesini kaldır

`StickerCalculator.tsx` dosyasında en alttaki "Maliyet Detayı" bölümünü tamamen KALDIR. İçinde:
- "Fason Üretim", "Üretim Ara Toplam", "Hazırlık", "Paketleme", "Operasyon Ara Toplam"
- "Maliyet (Alış)", "Satış Fiyatı", "Kâr", "İşlem Ücreti", "KDV", "Müşteri Satış Fiyatı"
- "LIVE CONFIG" badge
- Teknik alt yazılar (m2_cost_try, m2_sell_try, PSP gross-up, site config)

Bu bilgiler zaten üstteki kartlarda gösteriliyor — tekrar gereksiz.

---

## FIX 6 — Sepet bölümünü kaldır

`StickerCalculator.tsx` dosyasında:
- "Sepet" kartını/panelini tamamen KALDIR
- "Sepete Ekle" butonunu KALDIR
- `CartPanel` bileşeni render'ını KALDIR
- `addToCart`, `CartItem`, `CartPanel` import'larını KALDIR
- Cart ile ilgili tüm state'leri KALDIR

Bu hesaplayıcıdan manuel sipariş verilmiyor.

---

## FIX 7 — Sol panel müşteri konfigüratörü gibi olsun

Sol paneli tamamen yeniden düzenle — müşteri tarafındaki `/sticker/yapilandir` akışıyla aynı:

### Kart 1: Ürün Özellikleri
Malzeme seçimi KART olarak (dropdown DEĞİL):
```
MALZEME
[Vinil] [Transparan] [Holografik] [Simli]    ← kart seçim, aktif vurgulanır
```

Finiş seçimi KART olarak:
```
FİNİŞ
[Yok] [Parlak] [Mat]                          ← kart seçim
```

Kesim tipi:
```
KESİM
[Tabaka] [Die Cut]                            ← toggle
```

### Kart 2: Boyut + Adet
```
BOYUT (mm)
[40] × [60]

ADET
[25] [50] [100] [250] [500] [1000]            ← tier butonları
```

### Kart 3: Fason Maliyet
```
FASON BİRİM MALİYET
[415] ₺/m²
```

### Kart 4: Operasyon (toggle ile açılıp kapanır)
Toggle switch ile aktif/devre dışı — dün eklenen `operation.enabled` yapısını kullan:
```
OPERASYON [aktif/devre dışı toggle]
Hazırlık:   [50] ₺
Paketleme:  [15] ₺/zarf
Komisyon:   [2.5] %
```
Devre dışı olunca alanlar gri + tıklanamaz.

### KALDIR:
- "Müşteri Tipi" dropdown'u
- "LIVE SETUP", "LIVE KDV" input'ları (config'ten otomatik gelsin)
- "m2_cost / m2_sell" teknik etiketleri
- "Operasyon · Simülasyon" açıklama metni
- "Site Fiyat Önizleme" kartı (malzeme/finiş seçimi Kart 1'e taşındı)

---

## FIX 8 — Tier indirim/zam oranları site fiyatına uygulanmalı, simülasyona DEĞİL

Önemli iş kuralı:

**Site fiyatı (müşteriye satış):** Tier çarpanları (adet kademesi) UYGULANIR. 25 adet +%30 zam, 500 adet -%10 indirim gibi. Bu `calculatePrice()` zaten yapıyor.

**Simülasyon maliyeti (fason/üretim):** Tier çarpanları UYGULANMAZ. Üretici bize indirim uygulamıyor — fason rate sabit. Simülasyon maliyet = `fasonRate × totalM2` (düz çarpım, tier yok).

**Kâr hesabı:** Site satış fiyatı (tier uygulanmış) - Simülasyon maliyet (tier uygulanmamış) = Net kâr.

Örnek (250 adet, tier referans ×1.0):
```
Simülasyon maliyet:  415 ₺/m² × 1.636 m² = 679 ₺ (sabit, tier yok)
Site satış (KDV hariç): 1.080 ₺ (tier ×1.0 referans)
Net kâr: 1.080 - 679 = 401 ₺ (%59)
```

Örnek (25 adet, tier +%30 zam):
```
Simülasyon maliyet:  415 ₺/m² × 0.xxx m² = YYY ₺ (sabit, tier yok)
Site satış (KDV hariç): ZZZ ₺ (tier ×1.3 zam uygulanmış)
Net kâr: ZZZ - YYY = ??? ₺ (daha yüksek kâr oranı)
```

Örnek (1000 adet, tier -%20 indirim):
```
Simülasyon maliyet:  415 ₺/m² × X.xxx m² = YYY ₺ (sabit, tier yok)
Site satış (KDV hariç): ZZZ ₺ (tier ×0.8 indirim uygulanmış)
Net kâr: ZZZ - YYY = ??? ₺ (daha düşük kâr oranı)
```

**Kontrol:** Her tier butonuna tıkla — simülasyon maliyet sadece m² değişiminden etkilenmeli (daha fazla adet = daha fazla m²), tier çarpanından DEĞİL. Site fiyatı ise tier çarpanıyla birlikte değişmeli. Net kâr doğru hesaplanmalı.

---

## KONTROL

Her fix sonrası:
1. `npx tsc --noEmit` → 0 hata
2. Commit yap (`fix(calculator):` prefix)
3. Sayfa açılıyor mu, fiyat hesaplanıyor mu kontrol et

Tüm fix'ler bittikten sonra: müşteri konfigüratöründe (`/sticker/yapilandir`) aynı parametrelerle (Vinil + Parlak + 50×50 + 250 adet) fiyat hesapla, hesaplayıcıdaki site fiyatıyla aynı mı kontrol et. Farklıysa düzelt.
