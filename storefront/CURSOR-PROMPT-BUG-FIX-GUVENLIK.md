# Güvenlik Bug Fix — Yüksek Öncelik (Batch 2)

> Kritik batch (KVKK + para) bittikten SONRA uygula: `@CURSOR-PROMPT-BUG-FIX-KRITIK.md`
> Bu batch: ödeme race, admin bypass, RBAC, middleware.
> Her görev sonrası `npx tsc --noEmit` + commit. ÖNCE her bulguyu kodda doğrula.

---

## GÖREV H1+H2 — Sipariş İptali: Atomik + İade Rollback

### Dosya: `src/app/api/orders/[id]/cancel/route.ts`

**Sorun:**
- H1: PayTR iadesi başarılı → status update fail → para gitti, sipariş hâlâ aktif
- H2: TOCTOU — status kontrolü bellekte, update'te `.in("status", ...)` guard yok → çift iptal/race

**Çözüm:**
1. **Önce DB status'u atomik kilitle, SONRA iade çağır:**
```typescript
// 1. Atomic claim: sadece iptal edilebilir durumdaysa "cancelling" yap
const { data: claimed } = await admin
  .from("orders")
  .update({ status: "cancelling" })
  .eq("id", orderId)
  .in("status", ["pending", "paid", "proof_pending"])  // iptal edilebilir durumlar
  .select("id, status, payment_status")
  .maybeSingle();

if (!claimed) return NextResponse.json({ error: "Sipariş iptal edilemez durumda" }, { status: 409 });

// 2. İade gerekiyorsa PayTR refund çağır
let refundOk = true;
if (claimed.payment_status === "paid") {
  refundOk = await processRefund(orderId);  // mevcut refund logic
}

// 3. İade başarısızsa → status'u GERİ AL (rollback), hata dön
if (!refundOk) {
  await admin.from("orders").update({ status: claimed.status }).eq("id", orderId);
  return NextResponse.json({ error: "İade başarısız, iptal geri alındı" }, { status: 502 });
}

// 4. İade başarılı → cancelled
await admin.from("orders").update({ status: "cancelled", cancelled_at: now }).eq("id", orderId);
```
> Eğer `cancelling` ara durumu enum'da yoksa: refund'u önce yapma riskli. Alternatif: refund idempotency key kullan (mevcut Mig 069), update fail olursa refund tekrar denenebilir olsun. Cursor mevcut refund idempotency'yi kontrol etsin.

### Doğrulama
- İki eşzamanlı iptal → biri 409
- Refund fail senaryosu (mock) → sipariş eski durumuna döner, para gitmiş gösterilmez

---

## GÖREV H3 — Admin Bypass Checkout: Fiyat Doğrulama Yok

### Dosya: `src/app/api/admin/orders/bypass-checkout/route.ts`

**Sorun:** `assertAdmin()` var ama client'tan gelen `subtotal`/`total` doğrulanmadan kabul ediliyor. Yanlış/manipüle fiyatla sipariş oluşur.

**Çözüm:**
- `validateCartPricing` (payment-validation.ts) çağrısı ekle — manuel siparişte de fiyat server-side hesaplansın
- Client total'ı sadece gösterim; DB'ye server-hesaplı total yazılsın
- Manuel indirim meşruysa (admin iskontosu) → ayrı `manual_discount` alanı + audit log, ama base fiyat yine server'dan

### Doğrulama
- Bypass checkout → fiyat server'dan hesaplanıyor, client total override edemiyor

---

## GÖREV H4 — Payment Refund: Permission Eksik

### Dosya: `src/app/api/payment/refund/route.ts`

**Sorun:** `assertAdmin()` kullanıyor — finans modül izni atlanıyor. Operatör rolü iade yapabilmemeli.

**Çözüm:**
```typescript
// assertAdmin() yerine:
await assertPermission("payments", "update");  // veya "finans" modülü
```
- RBAC'te iade yetkisi sadece admin + finance rolünde olmalı, operations'ta değil

### Doğrulama
- Operatör rolü → iade 403
- Finance/admin rolü → iade OK

---

## GÖREV H5 — Dev Mock-Checkout Prod Guard

### Dosya: `src/app/api/dev/mock-checkout/route.ts`

**Sorun:** Prod env yanlış yapılandırılırsa ücretsiz sipariş oluşturulabilir.

**Çözüm:**
```typescript
// Route'un EN BAŞINA:
if (process.env.NODE_ENV === "production") {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```
- Çift güvenlik: ek olarak `ENABLE_DEV_ENDPOINTS !== "true"` kontrolü

### Doğrulama
- Prod build → `/api/dev/mock-checkout` 404

---

## GÖREV H6 — Support Ticket: Sahiplik Kontrolü Yok

### Dosya: `src/app/api/support/create/route.ts`

**Sorun:** `order_id` ile ticket açılırken siparişin kullanıcıya ait olduğu kontrol edilmiyor → başkasının siparişine ticket.

**Çözüm:**
```typescript
// order_id verilmişse sahiplik doğrula:
if (orderId) {
  const { data: order } = await admin
    .from("orders").select("user_id").eq("id", orderId).maybeSingle();
  if (!order || order.user_id !== user.id)
    return NextResponse.json({ error: "Bu sipariş size ait değil" }, { status: 403 });
}
```

### Doğrulama
- Başka kullanıcının order_id'si ile ticket → 403

---

## GÖREV M7 — Middleware RBAC Fail-Closed

### Dosya: `middleware.ts`

**Sorun:** `fn_has_permission` hata verirse guard atlanıyor (fail-open) → yetkisiz erişim.

**Çözüm:**
```typescript
// Permission kontrolü try/catch'te ise:
try {
  const allowed = await checkPermission(...);
  if (!allowed) return redirectToLogin();
} catch (e) {
  // FAIL-CLOSED: hata = erişim YOK (prod'da)
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Service unavailable", { status: 503 });
  }
  // dev'de log + geç
}
```
- Mevcut Mig P1.4 fail-closed pattern'i (security memory) ile tutarlı

### Doğrulama
- Permission RPC hata simülasyonu → prod'da 503, erişim verilmiyor

---

## GÖREV H10 — CRM Activity Log İzin Hizalama

### Dosya: `src/app/api/admin/customers/[id]/activity-log/route.ts`

**Sorun:** POST `customers.create` izni istiyor ama operatör Mig 119'da sadece `customers.view` aldı → operatör not ekleyemiyor (403).

**Çözüm:**
- Activity log ekleme için doğru izin: `customers.update` veya yeni `customers.note` aksiyonu
- Operatör preset'ine bu izni ekle (operatör müşteri notu ekleyebilmeli — operasyonel)
- Migration veya RBAC preset güncellemesi

### Doğrulama
- Operatör rolü → CRM not ekle çalışıyor

---

## UYGULAMA SIRASI

| Görev | Risk | Süre |
|-------|------|------|
| H5 dev mock guard | Düşük | 5 dk |
| H6 support ownership | Düşük | 10 dk |
| H4 refund permission | Düşük | 10 dk |
| H10 CRM izin | Düşük | 15 dk |
| H3 bypass checkout | Orta | 30 dk |
| M7 middleware fail-closed | Orta | 20 dk |
| H1+H2 cancel atomic+rollback | Yüksek (dikkat) | 45 dk |

**Toplam: ~2.5 saat.** Kolay olanlardan başla (H5,H6,H4,H10), riskli olanı (H1/H2) en sona.

## GENEL KURALLAR
- Her bulguyu ÖNCE kodda doğrula (analiz yanlış olabilir)
- `npx tsc --noEmit` + commit
- Önek: `fix(security):`
- `assertPermission` pattern'i mevcut RBAC'ten al
- H1/H2 refund rollback'i en kritik — mevcut refund idempotency (Mig 069) ile uyumlu olsun
