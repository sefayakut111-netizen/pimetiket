# Cursor — Tasarım Promote Akışı Detaylı Debug + Fix (KRİTİK)

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Kullanıcı tasarım yüklüyor ama sipariş oluşunca tasarım tanınmıyor.
> `hasDesigns=false` geliyor, sipariş detayda "Henüz tasarım yüklemedin" gösteriyor.

---

## SORUN

1. Kullanıcı sticker/etiket konfigüratöründe tasarım yüklüyor
2. Sepete ekliyor
3. Ödeme yapıyor (admin bypass veya PayTR)
4. `/odeme-sonuc?hasDesigns=false` — tasarım yok gibi davranıyor
5. Sipariş detayda "Henüz tasarım yüklemedin" gösteriyor
6. Panelim'de "Tasarım yüklemen lazım" kırmızı buton gösteriyor

## KÖK SEBEP ANALİZİ — SIRASYLA KONTROL ET

### Adım 1: Konfigüratörde designTempId set ediliyor mu?

Dosyalar:
- `src/app/sticker/yapilandir/page.tsx` — sepete ekle butonu
- `src/app/etiket/yapilandir/page.tsx` — sepete ekle butonu
- `src/components/ui/DesignDropZone.tsx` — tasarım yükleme bileşeni

Kontrol et:
1. Tasarım yüklenince `designTempId` state'e set ediliyor mu?
2. Sepete ekle payload'ında `designTempId` gönderiliyor mu?
3. `addToCustomerCart()` çağrısında `designTempId` field'ı var mı?

### Adım 2: Cart item'da designTempId tutuluyor mu?

Dosyalar:
- `src/lib/customer-cart.ts` — `addToCustomerCart()`, `CustomerCartItem` interface

Kontrol et:
1. `CustomerCartItem` interface'inde `designTempId` field'ı var mı? (EVET — satır 76)
2. `addToCustomerCart()` fonksiyonu bu field'ı kaydediyor mu?
3. `listCustomerCart()` bu field'ı geri döndürüyor mu?
4. localStorage veya DB'de designTempId persist ediliyor mu?

### Adım 3: Ödeme sayfasında cartItems'da designTempId görünüyor mu?

Dosya: `src/app/odeme/page.tsx`

Kontrol et:
1. `cartItems` state'inde `designTempId` field'ı var mı?
2. Console.log ekle: `console.log("cartItems designTempIds:", cartItems.map(i => i.designTempId))`
3. Admin bypass butonunda `cartItems.some((i) => !!i.designTempId)` ne döndürüyor?

### Adım 4: createCustomerOrder'da designTempId order_items.meta'ya yazılıyor mu?

Dosya: `src/lib/customer-order.ts` — `createCustomerOrder()` ve `fn_create_order` RPC

Kontrol et:
1. `createCustomerOrder()` payload'ında `items[].designTempId` var mı?
2. `fn_create_order` RPC'ye gönderilen `p_items` JSON'ında `designTempId` var mı?
3. DB'de `order_items.meta.designTempId` yazılıyor mu?

### Adım 5: promoteOrderDesigns order_items.meta.designTempId'yi buluyor mu?

Dosya: `src/lib/storage/promote-temp-designs.ts`

Kontrol et:
1. `orderItems` parametresinde `meta.designTempId` var mı?
2. `design_temp_uploads` tablosunda bu ID ile kayıt var mı?
3. `promoted_to` null mı (henüz promote edilmemiş)?

### Adım 6: admin-bypass-promote endpoint çalışıyor mu?

Dosya: `src/app/api/orders/admin-bypass-promote/route.ts`

Kontrol et:
1. Endpoint'e istek ulaşıyor mu? (console.log ekle)
2. `orderItems` filtrelendikten sonra boş mu doluyor mu?
3. `promoteOrderDesigns()` kaç adet promote ediyor?
4. Response'da `promoted: 0` mı dönüyor?

---

## OLASI SORUNLAR VE FIX'LER

### Olası Sorun A: Konfigüratör designTempId'yi sepete EKLEMIYOR

Sticker/etiket konfigüratöründe tasarım yüklemesi `DesignDropZone` ile yapılıyor. Bu component `onUpload` callback'i ile `designTempId` döndürüyor. AMA sepete ekle butonunda bu ID cart item payload'ına eklenmiyor olabilir.

**Fix:** Konfigüratör sayfasında sepete ekle fonksiyonunu bul, `designTempId` field'ını payload'a ekle.

### Olası Sorun B: fn_create_order RPC meta'yı strip ediyor

`fn_create_order` SQL fonksiyonu item meta'yı `jsonb` olarak alıyor ama belirli field'ları beyaz listeyle INSERT ediyor olabilir — `designTempId` beyaz listede olmayabilir.

**Fix:** Migration'daki RPC'yi kontrol et, `designTempId`'nin meta'da kalıp kalmadığını doğrula.

### Olası Sorun C: design_temp_uploads tablosunda kayıt yok

Tasarım yükleme pre-purchase endpoint'i (`/api/design/temp-upload` veya benzeri) çalışmıyor olabilir — dosya Storage'a yükleniyor ama `design_temp_uploads` row'u oluşturulmuyor.

**Fix:** Temp upload endpoint'ini kontrol et, DB row'u oluşturulduğunu doğrula.

---

## DEBUG YAKLAŞIMI

Her adımda console.log ekle ve browser console'dan takip et:

```typescript
// Konfigüratörde sepete eklerken:
console.log("[cart-add] designTempId:", designTempId);

// Ödeme sayfasında:
console.log("[odeme] cartItems designTempIds:", cartItems.map(i => ({ id: i.id, designTempId: i.designTempId })));

// Admin bypass'ta:
console.log("[admin-bypass] hasDesigns:", cartItems.some(i => !!i.designTempId));

// Promote endpoint'te:
console.log("[promote] orderItems with designTempId:", orderItems.length);
console.log("[promote] result:", promoted);
```

Sorunun tam olarak NEREDE koptuğunu bul ve düzelt.

---

## TEST

1. Sticker konfigüratörüne git
2. Tasarım yükle (PNG)
3. Sepete ekle
4. Browser console'da `designTempId` değerini gör
5. Ödeme sayfasına git
6. Admin bypass'a tıkla
7. `/odeme-sonuc?hasDesigns=true` olmalı ✅
8. Sipariş detayda "Dosya yüklendi" görmeli ✅
9. AI QC tetiklenmeli ✅

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
