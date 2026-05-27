Analytics sistemini 3 katmanda gelistir. Mevcut posthog-events.ts altyapisini kullan. Emoji kullanma.

Mevcut dosyalar:
- `src/lib/analytics/posthog-events.ts` — track() ve identify() fonksiyonlari
- `src/app/odeme-sonuc/page.tsx` — purchase event zaten var

---

## KATMAN 1 — Funnel Tracking (Donusum hunisi)

Her adima event ekle. Musteri nerede dusuyor gorunsun.

### 1a. Urun sayfasi goruntulenme
Dosya: `src/app/sticker/page.tsx` + `src/app/etiket/page.tsx`

```typescript
// Sayfa mount'unda:
useEffect(() => {
  track("product_viewed", { product: "sticker" }); // veya "etiket"
}, []);
```

### 1b. Konfigurator basladi
Dosya: `src/app/sticker/yapilandir/page.tsx` + `src/app/etiket/yapilandir/page.tsx`

```typescript
// Sayfa mount'unda:
useEffect(() => {
  track("configurator_started", { product: "sticker" });
}, []);
```

### 1c. Konfigurator adim degisimi
Her adim tamamlandiginda (malzeme, boyut, adet, tasarim):

```typescript
// Adim tamamlandiginda:
track("configurator_step", {
  product: "sticker",
  step: "material", // veya "size", "quantity", "design", "finish"
  value: selectedMaterial, // ornegin "vinil"
});
```

### 1d. Tasarim yuklendi
Dosya: `src/components/sticker/MultiDesignUploader.tsx`

```typescript
// Dosya yukleme basarili oldugunda:
track("design_uploaded", {
  product: "sticker",
  fileType: file.type,
  fileSize: file.size,
  designCount: designs.length,
});
```

### 1e. Sepete eklendi
Dosya: yapilandir sayfalarinda "Sepete ekle" butonu

```typescript
// addToCustomerCart sonrasi:
track("add_to_cart", {
  product: "sticker",
  material: selectedMaterial,
  qty: tier,
  total: total,
  designCount: designCount,
});
```

### 1f. Sepet goruntulendi
Dosya: `src/app/sepet/page.tsx`

```typescript
useEffect(() => {
  track("cart_viewed", {
    itemCount: cartItems.length,
    total: cartTotal,
  });
}, []);
```

### 1g. Odeme basladi
Dosya: `src/app/odeme/page.tsx`

```typescript
// Zaten begin_checkout event var — kontrol et, yoksa ekle:
track("checkout_started", {
  itemCount: cartItems.length,
  total: effectiveTotal,
  hasCoupon: !!couponCode,
});
```

### 1h. Odeme tamamlandi
Dosya: `src/app/odeme-sonuc/page.tsx` — zaten purchase event var, kontrol et dogru calisiyor mu.

### 1i. Prova onaylandi
Dosya: `src/app/onay/[orderId]/page.tsx` — handleApprove fonksiyonunda:

```typescript
// Onay basarili oldugunda:
track("proof_approved", {
  orderId: orderId,
  itemCount: summary.total,
});
```

---

## KATMAN 2 — Kullanici Davranisi Event'leri

### 2a. Malzeme secimi
Dosya: yapilandir sayfalarinda malzeme tiklandiginda:

```typescript
track("material_selected", {
  product: "sticker",
  material: materialId, // "vinil", "transparan", "holo", "simli"
});
```

### 2b. Boyut secimi
Preset tiklandiginda veya boyut girildiginde:

```typescript
track("size_selected", {
  product: "sticker",
  width: width,
  height: height,
  preset: isPreset, // true/false
});
```

### 2c. Adet secimi
Tier butonuna tiklandiginda:

```typescript
track("tier_selected", {
  product: "sticker",
  qty: selectedTier,
  tierLabel: tier.label, // "+%20 zam" veya "-%10 indirim"
});
```

### 2d. Pim sohbet
Dosya: `src/components/pim/PimChat.tsx`

```typescript
// Chat acildiginda:
track("pim_chat_opened", { page: pathname });

// Mesaj gonderildiginde:
track("pim_chat_message_sent", { persona: persona });
```

### 2e. AI QC sonucu
Dosya: `src/lib/agents/run-order-qc.ts` — QC tamamlandiginda:

```typescript
track("design_qc_result", {
  orderId: orderId,
  verdict: aggregateVerdict, // "ready_to_proof", "needs_review", "escalated"
  fileCount: ranCount,
});
```

NOT: Bu server-side — PostHog server SDK veya event API kullanilabilir. Yoksa atla.

### 2f. Prova reddedildi
Dosya: onay sayfasinda "Duzelt" veya "Yardim iste" tiklandiginda:

```typescript
track("proof_rejected", {
  orderId: orderId,
  reason: "edit_requested", // veya "help_requested"
});
```

### 2g. Siparis iptal
Dosya: siparis detay veya admin panelden iptal edildiginde:

```typescript
track("order_cancelled", {
  orderId: orderId,
  reason: cancelReason, // varsa
  total: orderTotal,
});
```

---

## KATMAN 3 — GA4 E-Commerce Event'leri

GA4 standart e-commerce event'lerini de gonder (Google Ads donusum izleme icin):

Dosya: `src/lib/analytics/ga4-events.ts` (yeni olustur)

```typescript
export function ga4Event(name: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
}

// Standart GA4 e-commerce event'leri:
export function ga4ViewItem(product: string, price: number) {
  ga4Event("view_item", {
    currency: "TRY",
    value: price,
    items: [{ item_name: product }],
  });
}

export function ga4AddToCart(product: string, qty: number, price: number) {
  ga4Event("add_to_cart", {
    currency: "TRY",
    value: price,
    items: [{ item_name: product, quantity: qty, price: price / qty }],
  });
}

export function ga4BeginCheckout(total: number, itemCount: number) {
  ga4Event("begin_checkout", {
    currency: "TRY",
    value: total,
    items: [{ item_name: "order", quantity: itemCount }],
  });
}

export function ga4Purchase(orderId: string, total: number) {
  ga4Event("purchase", {
    transaction_id: orderId,
    currency: "TRY",
    value: total,
  });
}
```

Bu fonksiyonlari PostHog event'leriyle ayni yerlerde cagir — iki sisteme de veri gider.

---

## KONTROL

Her katman sonrasi: `npx tsc --noEmit` + commit (`feat(analytics):` prefix)

Test:
1. Konfigurator ac → "configurator_started" event PostHog'da gorunuyor mu?
2. Malzeme sec → "material_selected" event
3. Sepete ekle → "add_to_cart" event
4. Odeme yap → "purchase" event (PostHog + GA4)
5. Prova onayla → "proof_approved" event
6. Pim sohbet ac → "pim_chat_opened" event

NOT: PostHog ve GA4 env key'leri Vercel'de tanimli olmali. Yoksa event'ler sessizce atlanir (no-op) — site bozulmaz.
