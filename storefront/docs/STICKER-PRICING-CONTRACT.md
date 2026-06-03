# Sticker Fiyat Sistemi — KONTRAT (değişmez sınırlar)

> Tek otorite belge. Sticker fiyat/geometri'sine dokunan herkes (Sefa, Cursor, Claude, fiyat-hesaplama-uzmani ajanı)
> ÖNCE bunu okur. Kural ihlali = bug. Son güncelleme: 3 Haz 2026 (geometri rewrite + toplamsal çarpan + config motoru sonrası).

## 0) 3 AYRI ÜRÜN — ASLA KARIŞTIRMA
| Ürün | Modül | Bu kontratın kapsamı |
|---|---|---|
| **Sticker** | `pricing-engine/geometry.ts` + `constants.ts` + `customer-pricing-from-config.ts` + `sticker-customer-pricing.ts` | ✅ BU BELGE |
| Rulo etiket | `pricing-engine/etiket-pricing.ts` + `etiket-customer-pricing.ts` | ❌ ayrı |
| Tabaka etiket | `pricing-tabaka-geo.ts` (33×45 SABİT) | ❌ ayrı |
"tabaka" kelimesi tuzak: sticker-tabaka = esnek 23×31 (geometry.ts) ≠ etiket-tabaka = 33×45 sabit.

## 1) VERİ AKIŞI (tek yön, tek motor)
```
computeGeometry(geometry.ts)  →  totalM2 (fireli rulo m² = faturalanabilir alan)
        ↓  billable_m2 = totalM2
calculatePrice(pricing-calc.ts, config + cut_type)   ← TEK hesap yolu
        ↓
   ÇIFT ÇIKTI:  final (SATIŞ, müşteri, KDV dahil)  +  cost_total (MALİYET, partner alacağı)
```
- **Müşteri + checkout:** `quoteStickerFromConfig` → calculatePrice (otorite).
- **Hesaplayıcı:** `liveSitePrice = calculatePrice(...)` — AYNI motor, AYNI argümanlar. SATIŞ=final, MALİYET=cost_total×(1+KDV), FARK=SATIŞ−MALİYET.
- **Fallback:** `quoteCustomerSticker` — YALNIZ `adminConfig===null` iken. Checkout her zaman config motoruyla server'da reprice eder (`/api/cart/reprice`).

## 2) DEĞİŞMEZ KURALLAR (kontrat)
1. **Tek otorite = config** (`pricing_config.live_config`). Hardcode fiyat YASAK (tek istisna: FALLBACK_STICKER_CONFIG / fallback motoru).
2. **`calculatePrice` = TEK hesap yolu.** İkinci paralel fiyat formülü açmak YASAK.
3. **`cut_type` + `billable_m2` her sticker çağrısında ZORUNLU.** Eksikse: cut_type→"diecut" varsayar (yanlış ×1.10), billable_m2→`area×qty`'ye düşer (fire kaybolur). **İkisini geçmeden çağırma.**
4. **`computeGeometry` = tek geometri kaynağı.** totalM2 = faturalanabilir m². Geometri başka yerde yeniden hesaplanmaz.
5. **`cost.ts` / `totalM2` / `sheetAreaM2` DOKUNULMAZ.** cost.ts fatura motoru; sheetAreaM2 display-only. Fiyat config'ten gelir, cost.ts'ten DEĞİL.
6. **laminasyon% + kesim çarpanı TOPLAMSAL:** `× (1 + Σopt% + (cutMult−1))`. Çarpımsal DEĞİL (die-cut+parlak = ×1.20, ×1.21 değil).
7. **kisscut/kartli → diecut GEOMETRİ; çarpan = GERÇEK cut.** `resolveStickerGeomCut` map'i fiyat çarpanını DEĞİŞTİREMEZ. kartli dims'e +10mm.
8. **Hesaplayıcı = config'i SALT-OKUR.** Oran/m²/çarpan override YOK; what-if sadece girdilerde (boyut, adet, kesim, malzeme, laminasyon). Garanti: aynı girdide **Hesaplayıcı SATIŞ == müşteri fiyatı**.
9. **Runner = bozulma alarmı.** `payment-validation-kartli-regression.runner.ts` her fiyat/geometri değişiminde yeşil olmalı; kırmızıysa commit YOK.

## 3) GEOMETRİ MODELİ (sticker)
- **die-cut:** rulo tabaka EN **1500 SABİT** (`DIECUT_EN`; sol 30 başı + sağ 80 sonu → kullanılabilir 1390) × yükseklik **250-600 esnek** (üst/alt 30). **gap 20mm ZORUNLU** (kesim yırtılmasın; fire kaçınılmaz, BUG DEĞİL). Sütun=EN, satır=yükseklik. Dağıtım **tam-önce, son eksik** (ilk dolu, son kalan; <250→min 250). Fatura = 1500×Σ(yükseklik).
- **tabaka:** esnek iç tabaka max 230×310, kenar 1cm → 210×290, gap 3mm, eşit grid. `computeRollPlan` (rollW 250-600 × ROLL_L 1520).
- Overage ≤%10. ROLL_L=1520 yalnız tabaka; die-cut DIECUT_EN=1500.

## 4) ADMIN — 2 SİSTEM
- **Fiyat Yönetimi** (`/admin/fiyatlar`, config editör): Malzeme m² maliyet/satış · Laminasyon (maliyet%+satış%) · Kesim Çarpanı (diecut/kisscut/tabaka) · Adet kademeleri (tier) · Operasyon. **Sabit sistem bilgisi = tek kaynak.** (Canlı Simülasyon paneli kaldırıldı.)
- **Hesaplayıcı** (`?tab=calculator`, simülasyon): config'i okur, girdileri değiştirip anlık SATIŞ/MALİYET/FARK görürsün. Oranlar salt-okunur (#1 "Maliyet ve satış" panosu).

## 5) DOĞRULAMA REFLEKSİ (her değişiklikte)
1. Geotest: `scripts/_g.ts`'e `computeGeometry({...})`, `npx tsx`, sil. **50×50/250 die-cut → segH [600,390], m² 1.485, %56**; **tabaka → m² 1.062**.
2. Runner: **556.85₺** (geometri/fiyat sabitse). Fiyat değişirse baseline güncelle + eski→yeni not.
3. `rm -rf .next/dev/types && npx tsc --noEmit` → 0.
4. Canlı: Browser 2, `/admin/fiyatlar`.

## 6) YASAKLAR
die-cut 20mm gap azaltma · laminasyon×kesim çarpma · 2 motoru birleştirme · MALİYET=fason simülasyon · sticker-tabaka↔etiket-tabaka karıştırma · cost.ts/totalM2 değiştirme · cüzdan/puan/üyelik indirimi.
