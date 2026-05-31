# CURSOR PROMPT — Sepet Fiyat Tazeleme (fiyat-sürümü bazlı, zaman bazlı SİLME değil)

> **Mimari:** Claude (31 May) · **Uygulayan:** Cursor
> **Amaç:** Sepetteki ürün fiyatı (`unit`/`total`) ekleme anında donuyor. Admin fiyat yayınlayınca, o değişiklikten ÖNCE eklenmiş ürünler bayat fiyatla kalıyor. Bunu **24 saatte sepeti silerek değil**, **fiyat değiştiğinde o ürünü yeniden fiyatlayarak** çözüyoruz — sepet kaybı yok, her zaman güncel fiyat, sadece gerçekten fiyat değişince çalışır.

---

## 0) Tasarım özeti (NEDEN böyle)

- **Tetikleyici = fiyat değişimi**, keyfi saat değil. Her ürünün son fiyatlanma anı (`pricedAt`), ait olduğu scope'un `pricing_config.live_updated_at`'inden eskiyse → ürün bayat → yeniden fiyatla.
- Fiyat değişmediyse **hiçbir şey yapılmaz** (en sık durum, sıfır maliyet).
- Checkout zaten `validateCartPricing` ile sunucuda doğruluyor (yanlış fiyattan satış zaten olmuyor) — bu iş **sepet GÖRÜNÜMÜ** içindir ve **aynı recalc mantığını** yeniden kullanır (tek doğruluk kaynağı).
- **Sepeti asla körlemesine silme.** Sadece ürün gerçekten geçersizse (kaldırılmış malzeme/ürün, recalc başarısız) düşür — açık mesajla.

> **Kapsam dışı (ayrı, opsiyonel iş):** Terk edilmiş sepet hijyeni için **30-60 gün** uzun TTL + günlük cron. Bu spec'e DAHİL DEĞİL; fiyat tazeliğiyle karıştırma.

---

## 1) Veri modeli — `priced_at` ekle

Ürünün "en son ne zaman fiyatlandığı"nı "ne zaman eklendiği"nden (`addedAt`) ayır.

- **Migration (yeni, ör. `127_cart_priced_at.sql`):**
  ```sql
  alter table public.cart_items
    add column if not exists priced_at timestamptz not null default now();
  -- mevcut satırlar için added_at ile hizala (opsiyonel, default now da olur):
  update public.cart_items set priced_at = added_at where priced_at is null;
  ```
  Migration'ı uygulamak için repo kalıbı: `scripts/apply-migrations-NNN.mjs` (082/126 örneğine bak). **Prod'a uygulamadan Sefa onayı al.**
- **`CustomerCartItem` interface (`src/lib/customer-cart.ts:35-110`):** opsiyonel `pricedAt?: number` ekle (ms). DB map'inde `priced_at` → `pricedAt` (satır 245 `addedAt` map'inin yanına). `pricedAt` yoksa `addedAt`'e düş.

---

## 2) Scope tespiti + "bayat mı" kuralı

Her ürünün fiyat scope'u:
- Sticker → `"sticker"`
- Etiket, `meta.formFactor === "rulo"` → `"etiket_rulo"`
- Etiket, `meta.formFactor === "tabaka"` → `"etiket_tabaka"`

**Bayat kuralı:** `pricedAt < max(scope.live_updated_at, global.live_updated_at)`
(`"global"` scope KDV/marj gibi her şeyi etkiler → her zaman dahil et.)

`pricing_config.live_updated_at` okuma referansı: `src/lib/pricing-config.ts` (publish'te `live_updated_at`/`live_published_at` set ediliyor, satır ~219-230). Scope timestamp'lerini tek sorguyla al:
```sql
select scope, live_updated_at from pricing_config
where scope in ('sticker','etiket_rulo','etiket_tabaka','global');
```

---

## 3) Yeni endpoint — `POST /api/cart/reprice`

**Neden sunucu:** Checkout'la aynı recalc mantığını (tek doğruluk kaynağı) kullanmak ve client'a fiyat motoru config'i taşımamak için.

**Girdi:** `{ items: CustomerCartItem[] }`
**Akış:**
1. Scope timestamp'lerini oku (§2 sorgusu).
2. Her item için:
   - **Bayat değilse** → olduğu gibi dön.
   - **Bayatsa** → `src/lib/payment-validation.ts` içindeki mevcut **`recalcEtiket()` / `recalcSticker()`** helper'larını (checkout'un kullandığı) çağırarak yeniden hesapla:
     - **Başarılı + fiyat değişti** → yeni `unit`/`total`, `pricedAt = now`, `changed` listesine ekle.
     - **Başarılı + fiyat aynı** → sadece `pricedAt = now` (doğrulandı, bir daha boşuna hesaplama).
     - **Başarısız** (malzeme/ürün kaldırılmış, recalc null) → `removed` listesine ekle.
3. **Oturum varsa** (`getCurrentUser`): değişen ürünlerin `unit`/`total`/`priced_at`'ini `cart_items`'ta UPDATE et; `removed` olanları DELETE et.
4. **Dön:** `{ items: CustomerCartItem[], changed: {id,oldTotal,newTotal}[], removed: {id,title}[] }`

> Recalc helper'ları `payment-validation.ts`'te zaten var ve `validateCartPricing` tarafından kullanılıyor — **yeni fiyat mantığı YAZMA**, onları reuse et. Tolerans/sanity floor mantığı (satır 186/93/96) checkout'a özel; reprice'ta ham recalc yeterli.

---

## 4) Sepet yükleme entegrasyonu (client)

Latency için **bloklamadan** çalıştır: sepet anında snapshot fiyatıyla çizilsin, reprice arka planda gelince güncellesin.

- **`/sepet` (`src/app/sepet/page.tsx`):** mount'ta `refreshCustomerCart()` sonrası → `/api/cart/reprice`'a mevcut item'ları gönder → dönen `items` ile cache'i güncelle. Guest ise localStorage'ı da yeniden yaz (`writeLocal` kalıbı, `src/lib/customer-cart.ts`).
- **`/odeme` (`src/app/odeme/page.tsx`):** ödeme payload'u oluşturmadan ÖNCE bir reprice çağır → kullanıcı güncel toplamı görsün (yine de `payment/init` server doğrulaması son kale, ona dokunma).
- `refreshCustomerCart()`/`listCustomerCart()`'ın kendi içine network çağrısı **koyma** (her yerde çağrılıyor, yavaşlatma). Reprice'ı yalnız bu iki sayfada tetikle.

---

## 5) Bildirim / UI (sessiz olmasın)

Mevcut `pim_cart_merge_dropped` CustomEvent kalıbını taklit et (`src/lib/customer-cart.ts:431`):
- **`pim_cart_prices_updated`** → `{ count }` → `/sepet`'te toast: *"X ürünün fiyatı güncel tarifeye göre yenilendi."* + ilgili ürün kartında küçük **"fiyat güncellendi"** rozeti.
- **`pim_cart_items_removed`** → `{ titles }` → toast: *"Bazı ürünler artık sunulmadığı için sepetten kaldırıldı: …"*

---

## 6) Edge / kurallar

- Fiyat **düşmüş** olabilir de — fark etmez, güncel olan gösterilir (dürüst).
- Reprice başarısız (network/sunucu) → **sessizce snapshot fiyatıyla devam** et (sepet kırılmasın); checkout zaten doğrular.
- `meta.customizations` (multi-custom) ve `meta.formFactor` parse'ı için `payment-validation.ts:112-130` kalıbına bak.
- `designCount` per-design fiyatı etkiliyor → recalc'a dahil olduğundan emin ol (helper'lar zaten alıyor).

---

## 7) Doğrulama (fix sonrası)

```bash
cd pim-etiket/core/storefront
npx tsc --noEmit          # temiz olmalı
npm run verify:pricebook  # fiyat motoru regresyonu
```
Manuel:
- [ ] Ürün ekle → admin'de o scope'ta fiyat yayınla → `/sepet`'i aç → fiyat güncellendi + toast/rozet.
- [ ] Fiyat değiştirmeden `/sepet` aç → hiçbir şey değişmemeli (gereksiz recalc yok).
- [ ] Guest (çıkış yapılmış) sepette aynı senaryo → localStorage fiyatı güncellenir.
- [ ] Geçersiz/kaldırılmış malzeme → ürün "kaldırıldı" mesajıyla düşer.

---

## Dosya/fonksiyon referansları (reuse)

| İş | Dosya:satır | Fonksiyon |
|---|---|---|
| Sticker recalc | `src/lib/customer-pricing-from-config.ts:24` | `quoteStickerFromConfig()` |
| Etiket recalc | `src/lib/customer-pricing-from-config.ts:97` | `quoteEtiketFromConfig()` |
| Checkout doğrulama (reuse) | `src/lib/payment-validation.ts` | `validateCartPricing` / `recalcEtiket` / `recalcSticker` |
| Aktif fiyat damgası | `src/lib/pricing-config.ts:~219` | `live_updated_at` / `live_published_at` |
| Cart load (DB) | `src/lib/customer-cart.ts:356` | `refreshCustomerCart()` |
| Cart load (guest/sync) | `src/lib/customer-cart.ts:442` | `listCustomerCart()` |
| DB row map | `src/lib/customer-cart.ts:245` | `added_at`→`addedAt` (yanına `priced_at`) |
| Event kalıbı | `src/lib/customer-cart.ts:431` | `pim_cart_merge_dropped` |

**Kurallar:** Kilit/ödeme mantığına dokunma. Cüzdan/puan/üyelik indirimi YOK (CLAUDE.md). `payment/init` server doğrulaması son kaledir — değiştirme, sadece reuse et.
