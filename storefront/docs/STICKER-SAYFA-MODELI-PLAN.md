# Sticker Sayfası — SAYFA-BOYUTU Modeli (plan)

> Yeni özellik: "Sticker Sayfası" ürünleri **sayfa-boyutu** modeline geçer. Sefa kararı (3 Haz). SADECE sticker bölümü.
> Fiyat sistemi sözleşmesi: `docs/STICKER-PRICING-CONTRACT.md` geçerli; bu özellik onun §4'üne küçük genişletme (computeRollPlan köprüsü).

## Amaç / model (Sefa)
- "Sticker Sayfası" = müşteri **SAYFA boyutu** seçer, içinde **birden çok yarım-kesim alan**, **fiyat = seçilen sayfa m²** (kaç bireysel sticker dizildiği DEĞİL).
- **SADECE sticker bölümü** (açık), **sticker malzemeleri** (vinil/opak folyo/holografik/simli/şeffaf). Etiket/tabaka-etiket modülüne DOKUNMA.
- **qty = sayfa adedi.** Tasarım = tek sayfa dosyası (müşteri sayfanın tamamını tasarlar; multi-design kapalı). *(model paketi Sefa onayı bekliyor — varsayılan öneri.)*

## Boyutlar (preset)
A7 74×105 · A6 105×148 · A5 148×210 · A4 210×297 · kare 100×100 / 148×148 / 200×200 · şerit 50×210 / 210×50 / 100×210.
**A3 297×420 HARİÇ** (ticari karar — fiziksel sığıyor, sonradan eklenebilir).

## Fiyat/geometri
- `billable_m2 = computeRollPlan(sayfaW, sayfaH, qty).totalArea / 1e6` (sayfa rulo'ya tile, fire dahil). Yeni geo fonksiyonu YOK.
- `calculatePrice(scope="sticker")` AYNI motor; `cut_type="tabaka"` (nötr — sayfa zaten yarım-kesim, die-cut ×1.10 yok).
- Laminasyon VAR (toplamsal), tier VAR, kesim çarpanı YOK. Partner maliyeti = malzeme × sayfa m² (kontrat).
- Geotest baseline: A4 q25 → **1.979 m²** · A5 q25 → **1.055 m²** · hepsi plotter rulosuna sığıyor (en 250-600, boy 1520).

## Ayrıştırma (bireysel sticker BOZULMAZ)
- `pageMode` bayrağı **default false**. Yalnız 5 Sticker Sayfası kartı `?sayfa=1` taşır (yeni mig UPDATE).
- `pageMode=false` → tüm mevcut bireysel-sticker akışı BİREBİR korunur. Kartlı 556.85 değişmez.

## 3 FAZ (sıralı — faz yeşil olmadan ilerleme yok)
1. **Motor+test:** `quoteStickerFromConfig`/`quoteCustomerSticker` `pageMode` param + computeRollPlan köprü + regression sayfa case. `@CURSOR-PROMPT-SAYFA-MODELI-FAZ1.md`
2. **Konfigüratör UI:** sayfa preset seçici (chip + **SVG ikon**), qty="sayfa adedi", `sayfa=1` flag + mig UPDATE. (SVG Claude üretir.)
3. **Checkout reprice paritesi:** `/api/cart/reprice` (`quoteCartItemPrice`) sayfa-modunu server'da da uygulamalı (yoksa client≠server 400 — Kartlı `a707cde` dersi). Canlı test (Browser 2) + kontrat/baseline güncelle.

## Kritik risk
- Checkout reprice server-side `pageMode` paritesi (Faz 3) — atlanırsa `pricing_validation_failed`.
- Cart item `pageMode` flag'ini taşımalı (Faz 3).

## Sefa onayı bekleyen
- Model paketi (qty=sayfa/min, laminasyon+tier, kesim nötr, tasarım=tek sayfa) · zamanlama (şimdi vs launch sonrası).
