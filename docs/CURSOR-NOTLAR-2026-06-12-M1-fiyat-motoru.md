# Cursor Notları — M1: Konfigüratör & Fiyat Motoru

> Hata-tespit (P2). Boyut: D2 sözleşme, D5 veri bütünlüğü, D7 para. 3 fiyat modülü (sticker/rulo/tabaka) ayrı.
> **Olumlu:** Checkout `validateCartPricing` sağlam — client total'a güvenmiyor, server recalc zorunlu, fail→RED. Konfigüratör↔checkout aynı `quantizeForCart` kullanıyor (drift önlenmiş). Sıfıra bölme korumaları üst katmanda var.
> **Sorun:** reprice yolu zayıf, 3 modül arası formül drift'i, fee/KDV gross-up eksik recovery.

## 🔴 KRİTİK

### 1. reprice stale-olmayan satırda client `total`/`unit`'i doğrulamadan geçiriyor · D2
- **Konum:** `lib/cart-reprice.ts:136-169` + `api/cart/reprice/route.ts:59-70`
- **Sorun:** `repriceCartItems` yalnız `isItemStale()` (pricedAt < live_updated_at) satırları yeniden fiyatlar; stale olmayanda `result.push(item)` ile client `total`/`unit` doğrulanmadan döner ve `cart_items` DB'sine yazılır. `pricedAt` client-kontrollü → ileri tarih gönderip fiyat bypass + sepeti kalıcı manipüle. Tek gerçek koruma checkout `validateCartPricing`.
- **Düzeltme:** reprice'ta `pricedAt`'e güvenme; `live_updated_at`'i DB `priced_at` kolonundan oku veya persist öncesi `quoteCartItemPrice` ile doğrula; `unit×qty=total` sanity ekle.

### 2. `pricing_config_unavailable` durumunda kısmi reprice — diğer modüller doğrulanmadan geçer · D2/D5
- **Konum:** `api/cart/reprice/route.ts:30-47` — bir scope config'i boşsa o item silinir ama diğer modüllerin client fiyatı doğrulanmadan geçer (#1 ile birleşir).
- **Düzeltme:** Config indirilemezse tüm reprice'ı 503 ile durdur (all-or-nothing), checkout pattern'iyle hizala.

### 3. `findEtiketTier` "en yakın tier" → sınır fiyat sıçraması (3499 adet, 3500'den pahalı) · D7
- **Konum:** `lib/pricing-engine/etiket-pricing.ts:224-240`
- **Sorun:** Sticker `findTier` ceiling (qty ≤ eşik); etiket `Math.abs` ile **en yakın** tier seçiyor → qty=3499 → 2000 tier (×1.05), qty=3500 → 5000 tier (×1.00). Monotonik değil, "1 adet daha al ucuzlasın". Sticker'la formül drift'i. (Rulo ana akış pricebook `skip_tier` olduğu için kısmen maskeli; legacy/fallback yolda aktif.)
- **Düzeltme:** `findEtiketTier`'i ceiling mantığına çevir / `pricing-calc.findTier`'ı reuse et.

## 🟠 YÜKSEK

### 4. `applyRetailLayer` single-select'te "yok" filtrelemiyor + `operation.enabled` kontrol etmiyor · D7
- **Konum:** `lib/pricing-retail.ts:55-68, 100-103` (multi'de `id!=="yok"` var, single'da yok; `calculatePrice` `op.enabled!==false` kontrol eder, retail etmez) → admin `enabled=false` yaparsa rulo pricebook fazladan setup+packaging+cargo bindirir, diğer iki modülden fazla.
- **Düzeltme:** `applyRetailLayer`'a `op.enabled!==false` + single-select "yok" filtresi.

### 5. PSP fee gross-up KDV-hariç matrahtan → komisyonun ~%17'si recover edilmiyor (para sızıntısı) · D7
- **Konum:** `pricing-engine/cost.ts:270-277`, `pricing-calc.ts:432-440`, `pricing-retail.ts:109-114`
- **Sorun:** `subtotal=tieredPure/(1-fee)` → vat → total. PSP komisyonu gerçekte KDV dahil tahsilattan kesilir; burada yalnız KDV-hariç matraha gross-up → %20 KDV+%2.5 fee'de komisyonun ~%17'si Sefa'dan çıkar (1000 TL'de ~4-5 TL). Sistematik undercharge.
- **Düzeltme:** Gross-up'ı KDV dahil tutardan yap (`tieredPure×(1+vat)/(1-fee)`) — 3 motorda da; veya bilinçli kabulse dokümante et. (Doğrulama #1.)

### 6. reprice toleransı YOK, checkout %2 var → farklı karar · D7/D2
- **Konum:** `payment-validation.ts:522-539` (quote, tolerans yok) vs `:213-214,352-353` (recalc %2) → sepette görünen fiyatla checkout reddi arası tutarsızlık.
- **Düzeltme:** İki yolda da `quantizeForCart` tek otorite; reprice'ın unit/total'ını checkout aynen kabul etsin (idempotent).

### 7. Tabaka etiket için 3 farklı tier tablosu — erişilemez ölü tier'lar yanıltıcı label · D5
- **Konum:** `constants.ts:168-176` (1000-25000) vs `pricing-config-types.ts:212-219` (tabaka 250-10000) vs `:176-184` (rulo 1000-25000); `ETIKET_MAX_QTY=10000` → 15000+ tier'lar ölü ama label "−%12" gösterir.
- **Düzeltme:** Tier üst sınırını `ETIKET_MAX_QTY` ile hizala; erişilemez tier'ları kaldır.

### 8. Sticker recalc 5mm'ye izin veriyor ama konfigüratör min 25mm · D7/D2
- **Konum:** `pricing-engine/index.ts:66` (`W<5||H<5`) vs `sticker-customer-pricing.ts:84-86` (`STICKER_MIN_DIM=25`) → client 5-24mm sticker enjekte ederse konfigüratör reddeder, recalc kabul eder. `sanityCheckItem` 100mm² ile kısmen yakalar (12×12 geçer).
- **Düzeltme:** Server recalc'a da `STICKER_MIN_DIM` uygula.

## 🟡 ORTA
- **9.** `unitPrice=total/requestedQty` engine'de sıfıra bölme guard'ı yok (`cost.ts:278`, `pricing-calc.ts:441`) — public API doğrudan import edilebilir. → `requestedQty>0 ? : 0`. · D7
- **10.** Etiket `envelopeCount=rollsNeeded` paketleme maliyeti rulo başına bindiriyor — sticker "zarf" semantiğiyle aynı katsayı, birim anlamı tutarsız (`cost.ts:250`, `etiket-pricing.ts:261`). · D7
- **11.** `getCell` kare-hücre fallback'i dikdörtgen etikette yüksek fiyat verebilir (`pricing-pricebook-lookup.ts:28-34`) — `Math.max(w,h)` kare. Güvenli yön (overcharge) ama müşteri kaçırır. · D5
- **12.** Publish/revert'te optimistic lock yok (`admin/pricing/publish/route.ts:34-45`, `revert:42-54`) — iki admin yarışında live↔history tutarsız; yanlış `live_updated_at` tüm sepetleri yanlış "taze" sayabilir. · D2
- **13.** `quantizeForCart` total=round(unit×qty); etikette qty=10000, unit 0.4438→0.44 → 38 TL eksik tahsilat/satır (`pricing-quantize.ts:44-46`). Checkout %2 toleransı absorbe eder ama sistematik undercharge. · D7
- **14.** Sticker cut çarpanı iki kaynakta (`cut_multipliers` vs `CUT_MULT`) farklı yerde çarpılıyor (rate vs with_options) → adminConfig var/yok'ta fiyat sapması (`pricing-config-types.ts:139`, `sticker-customer-pricing.ts:62-67`). · D7

## 🟢 DÜŞÜK
- **15.** `DEFAULT_SELL_MULTIPLIER=1.5` eksik sell fiyatında sessiz %50 markup türetiyor (`pricing-dual-price.ts:13,20-38`) — admin uyarısı yok. · D5
- **16.** Multi-design `overrunCount` yalnız tek tasarımın overrun'ını döndürüyor (gösterim, fiyat etkisi yok). · D7

## [KOZMETİK]
- `etiket-pricing.ts:10` / `etiket-customer-pricing.ts:47-48` yorumları "Max 50000" diyor ama `ETIKET_MAX_QTY=10000` — yorum-kod drift.
- `constants.ts:139-141` `ETIKET_MIN_QTY=1000` ama tabaka min 250 — label "min 1000" tabaka'da yanlış.
- `cost.ts:101` `profit` `@deprecated` ama hâlâ dönüyor.

## ❓ Doğrulanacaklar
1. PSP komisyonu KDV dahil mi hariç tahsilattan kesiliyor (#5) — sözleşme.
2. `pricedAt` client-kontrollü mü yoksa sunucu `priced_at`'ten mi (#1/#2) — `customer-cart.ts`/`addToCustomerCart` (kapsam dışıydı).
3. `publishPricingConfig`/`revertPricingConfig` atomik mi (#12).
4. Canlı rulo %100 pricebook (`skip_tier`) mı, `findEtiketTier` yalnız legacy'de mi (#3) — legacy prod'da erişilebilir mi.

**En kritik:** #1+#2 (reprice güveni) · #3 (etiket tier monotonik değil) · #5 (fee/KDV recovery) · #13 (yüksek qty yuvarlama undercharge).
