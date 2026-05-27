`src/components/admin/pricing/StickerCalculator.tsx` dosyasını oku ve sol paneli tamamen yeniden organize et. Müşteri konfigüratörü (`src/app/sticker/yapilandir/page.tsx`) ile aynı akışta olmalı.

## MEVCUT SORUN

Sol paneldeki alanlar karmaşık ve müşteri tarafıyla tutarsız:
- "ÜRETİM · FASON" kartı: tek fason rate input'u
- "OPERASYON · SİMÜLASYON" kartı: hazırlık, paketleme, işlem ücreti, KDV
- "SİTE FİYAT ÖNİZLEME" kartı: live setup, live KDV, malzeme dropdown, finiş dropdown, müşteri tipi

Bunlar yerine müşteri konfigüratöründeki gibi basit akış olmalı.

## YENİ SOL PANEL YAPISI

### Kart 1: Ürün Seçimi (müşteri gibi)
```
MALZEME
[Vinil ▼] [Transparan ▼] [Holografik ▼] [Simli ▼]   ← seçim kartları veya dropdown

FİNİŞ
[Yok ▼] [Parlak ▼] [Mat ▼]                            ← seçim kartları veya dropdown

KESİM TİPİ
[Tabaka] [Die Cut]                                     ← toggle

KÖŞE
[Düz] [Yumuşatılmış]                                   ← toggle (sadece rectangle/diecut'ta)
```

### Kart 2: Boyut + Adet
```
STICKER BOYUTU (mm)
[40] × [60]                                            ← genişlik × yükseklik

ADET
[25] [50] [100] [250] [500] [1000]                     ← tier butonları
```

### Kart 3: Fason Maliyet (simülasyon)
```
FASON BİRİM MALİYET
[500] ₺/m²                                            ← fason rate input
```

## YENİ SAĞ PANEL YAPISI

Sağ panelde 2 ana bölüm olsun, belirgin şekilde ayrılmış:

### Bölüm 1: SİTE FİYATI (büyük, belirgin)
Müşterinin sitede göreceği gerçek fiyat. Live config'ten hesaplanır.
```
┌─────────────────────────────────────────────┐
│  SİTE FİYATI (KDV DAHİL)     BİRİM FİYAT   │
│  1.329 ₺                     ₺5,32 /adet    │
│  250 adet · 8 tabaka · 1.636 m²             │
│                                              │
│  MALİYET     SATIŞ      KÂR       KDV       │
│  687 ₺      1.080 ₺    393 ₺     221 ₺     │
│                         %57 kâr              │
└─────────────────────────────────────────────┘
```

### Bölüm 2: SİMÜLASYON MALİYETİ (küçük, altında)
Fason rate ile hesaplanan tahmini maliyet. Farkı göster.
```
┌─────────────────────────────────────────────┐
│  SİMÜLASYON MALİYETİ                        │
│  Fason: 687 ₺ (500 ₺/m² × 1.636 m²)       │
│  Site satış: 1.329 ₺                        │
│  ──────────────────────────                  │
│  FARK: +642 ₺ (%93 kâr)                    │
│  Fason bu fiyatla kârlı ✅                   │
└─────────────────────────────────────────────┘
```

### Bölüm 3: Rulo Plan SVG (mevcut, kalacak)
Tabaka yerleşim görseli.

## TEKNİK

- Sol panel'deki malzeme/finiş seçimi `liveStickerConfig.materials` ve `liveStickerConfig.options.finish` kullanılsın
- Seçilen malzeme + finiş + boyut + adet ile `calculatePrice()` çağrılsın → site fiyatı
- Fason rate × totalM2 → simülasyon maliyet
- Fark = site fiyatı - simülasyon maliyet

- "Üretim · Fason" toggle KALDIRILSIN — sadece fason mode (kendi makina modu gereksiz)
- "Üretim kalemleri" (paper, ink, coating, labor, overhead, depreciation) KALDIRILSIN
- "Operasyon · Simülasyon" kartı KALDIRILSIN — setup/paketleme config'ten gelsin
- "Müşteri tipi" dropdown KALDIRILSIN

- Lot, İstatistik, JSON kopyala, Sıfırla, İş Emri PDF butonları KALSIN

## EK — Alttaki maliyet detayı satırlarını kaldır

Sayfanın en altında satır satır maliyet kırılımı var (Maliyet Detayı / Cost Breakdown). Bu bilgi zaten sağ panelde MALİYET/SATIŞ/KÂR/KDV kartlarında gösteriliyor — tekrar yazmaya gerek yok. Bu bölümü tamamen KALDIR.

---

## KONTROL

Değişiklik sonrası:
1. Malzeme seç + finiş seç + boyut gir + adet seç → fiyat hesaplanıyor mu?
2. Site fiyatı müşteri konfigüratörüyle aynı mı?
3. Simülasyon maliyet doğru mu?
4. Fark doğru hesaplanıyor mu?
5. Rulo plan SVG doğru mu?
6. `npx tsc --noEmit` → 0 hata

Her fix sonrası commit (`refactor(calculator):` prefix).
