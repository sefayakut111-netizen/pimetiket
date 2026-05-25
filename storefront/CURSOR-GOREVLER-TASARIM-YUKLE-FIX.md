# Cursor Tasarım Yükleme Sayfası Donma Fix — KRİTİK

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/siparis/[id]/tasarim-yukle/page.tsx` (630 satır)
> API: `src/app/api/orders/[id]/upload-status/route.ts` (167 satır)
> Sayfa donuyor — 3 sorun bulundu, 3 fix.

---

## SORUN 1: Upload Sonrası Polling Döngüsü — DONMA ANA SEBEBİ

### Konum
`src/app/siparis/[id]/tasarim-yukle/page.tsx` satır 237-247

### Sorun
Upload sonrası while döngüsü 5×2sn = 10sn blokluyor. Her `load()` çağrısı `setOrder()` yapıyor → React re-render → `useEffect` (satır 131) tekrar `load()` çağırıyor → sonsuz render döngüsü + polling yarışı.

Ayrıca polling `awaiting_upload` kontrol ediyor ama Migration 105 (ödeme sonrası akış fix'i) trigger'ı artık `qc_pending`'e geçiriyor → polling hiç yakalamıyor → 5 deneme boşa gider.

### Fix

Satır 233-247'deki polling bloğunu tamamen değiştir:

```typescript
// ESKİ (satır 233-247):
// let fresh = await load({ silent: true });
// let attempts = 0;
// while (fresh && fresh.status === "awaiting_upload" && attempts < 5) {
//   await new Promise((r) => setTimeout(r, 2000));
//   attempts++;
//   fresh = await load({ silent: true });
// }

// YENİ — polling'i useEffect'e bırak, burada sadece 1 kez yenile:
await load({ silent: true });
// Status değişimi useEffect (satır 131) tarafından yakalanır
// ve gerekirse redirect yapılır. While döngüsü KALDIRILDI.
```

---

## SORUN 2: load() İçindeki Redirect — Upload Sırasında Sayfa Atlıyor

### Konum
`src/app/siparis/[id]/tasarim-yukle/page.tsx` satır 106-118

### Sorun
`load()` her çağrıldığında status kontrol edip redirect yapıyor. Upload sırasında status `qc_pending`'e geçerse müşteri dosya yüklüyor ama sayfa sipariş detaya atlıyor.

Ayrıca satır 114:
```typescript
if (data.status !== "awaiting_upload" && data.status !== "paid") {
  router.replace(`/siparis/${orderId}`);
```

Bu `qc_pending`, `proof_generating` gibi meşru QC statuslarında da tetikleniyor — müşteri hâlâ dosya yüklemek isteyebilir (multi-design).

### Fix

Status kontrolünü genişlet — QC statuslarında da sayfada kal:

```typescript
// ESKİ (satır 106-118):
// if (data.status === "proof_pending") {
//   router.replace(`/onay/${orderId}`);
//   return data;
// }
// if (data.status === "proof_approved") {
//   router.replace(`/onay/${orderId}/tamamlandi`);
//   return data;
// }
// if (data.status !== "awaiting_upload" && data.status !== "paid") {
//   router.replace(`/siparis/${orderId}`);
//   return data;
// }

// YENİ:
const STAY_ON_PAGE_STATUSES = [
  "paid",
  "awaiting_upload",
  "qc_pending",       // AI kontrol başladı ama dosya yüklenebilir
  "qc_flagged",       // AI sorun buldu ama müşteri düzeltebilir
  "human_review",     // operatör inceliyor ama müşteri ek dosya yükleyebilir
  "proof_generating", // prova hazırlanıyor
];

if (data.status === "proof_pending" || data.status === "proof_validating") {
  // Prova hazır — onay sayfasına yönlendir
  router.replace(`/onay/${orderId}`);
  return data;
}
if (data.status === "proof_approved") {
  router.replace(`/onay/${orderId}/tamamlandi`);
  return data;
}
if (!STAY_ON_PAGE_STATUSES.includes(data.status)) {
  // İleri status (in_production, shipped, delivered, cancelled)
  router.replace(`/siparis/${orderId}`);
  return data;
}
// Diğer durumlarda sayfada kal
```

---

## SORUN 3: MIME Type Kontrolü AI/PSD Reddediyor

### Konum
`src/app/siparis/[id]/tasarim-yukle/page.tsx` satır 157-159

### Sorun
AI (.ai) ve PSD (.psd) dosyalarının MIME type'ı tarayıcıda boş string (`""`) veya `application/octet-stream` gelebilir → geçerli dosya reddediliyor.

### Fix

MIME kontrolünü genişlet — extension bazlı fallback ekle:

```typescript
// ESKİ (satır 152-160):
// if (file.size > MAX_FILE_SIZE) { ... }
// if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) { ... }

// YENİ:
if (file.size > MAX_FILE_SIZE) {
  toast.error(`Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  return;
}

// MIME + extension kontrolü (AI/PSD tarayıcıda boş MIME verebilir)
const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.svg', '.ai', '.psd'];
const mimeOk = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
const extOk = ALLOWED_EXTENSIONS.includes(ext);

if (!mimeOk && !extOk) {
  toast.error(
    `Bu dosya formatı desteklenmiyor: ${file.type || ext || "bilinmeyen"}. ` +
    `Desteklenen: PNG, JPG, PDF, SVG, AI, PSD`
  );
  return;
}

// EPS kontrolü (yeni kural — EPS desteklenmez)
if (ext === '.eps') {
  toast.error('EPS formatı desteklenmiyor. Lütfen AI, PDF veya PNG olarak dışa aktarın.');
  return;
}
```

---

## EK FIX: allDone redirect + upload çakışması

### Konum
Satır 138-150 — `useEffect` tüm tasarımlar tamamlandığında redirect

### Sorun
`designsComplete` her item için true olduğunda 1.5sn sonra `/siparis/${orderId}`'ye redirect yapıyor. Ama upload henüz devam ediyorsa (`uploadingItemId !== null`) bu redirect upload'u kesiyor.

### Fix

```typescript
// ESKİ (satır 138-150):
// useEffect(() => {
//   if (!order) return;
//   const allDone = order.items.length > 0 && order.items.every((i) => i.designsComplete);
//   if (allDone) {
//     toast.success("Tum tasarimlar yuklendi...");
//     const t = setTimeout(() => router.push(`/siparis/${orderId}`), 1500);
//     return () => clearTimeout(t);
//   }
// }, [order, orderId, router, toast]);

// YENİ — upload sırasında redirect yapma:
useEffect(() => {
  if (!order) return;
  if (uploadingItemId) return; // upload devam ediyor, bekle

  const allDone =
    order.items.length > 0 &&
    order.items.every((i) => i.designsComplete);

  if (allDone) {
    toast.success("Tüm tasarımlar yüklendi — prova hazırlığı başlıyor...");
    const t = setTimeout(() => router.push(`/onay/${orderId}`), 2000);
    return () => clearTimeout(t);
  }
}, [order, orderId, router, toast, uploadingItemId]);
```

Değişiklikler:
1. `uploadingItemId` devam ediyorsa redirect yapma
2. Redirect hedefi `/siparis/${orderId}` → `/onay/${orderId}` (prova akışına yönlendir)
3. Timeout 1.5sn → 2sn (kullanıcı mesajı okusun)

---

## Uygulama sırası

| # | Fix | Süre |
|---|---|---|
| 1 | Polling while döngüsü kaldır | 5 dk |
| 2 | load() redirect status listesini genişlet | 10 dk |
| 3 | MIME type extension fallback | 10 dk |
| 4 | allDone redirect + upload çakışması | 5 dk |

Her fix sonrası: `npx tsc --noEmit` + commit.

**TEST:**
1. `/siparis/[id]/tasarim-yukle` aç → sayfa donmuyor ✅
2. PNG dosya yükle → başarılı, sayfa donmuyor ✅
3. AI (.ai) dosya yükle → kabul ediliyor (MIME boş olsa bile) ✅
4. PSD dosya yükle → kabul ediliyor ✅
5. EPS dosya yükle → "desteklenmiyor" hata mesajı ✅
6. Upload sırasında status qc_pending'e geçerse → sayfada kal ✅
7. Tüm tasarımlar yüklendi → 2sn sonra /onay'a redirect ✅

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
