# Cursor — Ödeme Sonrası → Onay Sayfası Akış Kontrol + Fix (KRİTİK)

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Kullanıcı sipariş verip tasarım yüklüyor ama bıçak çizimi/prova sayfasına hiç ulaşamıyor.
> Bu görev tüm akışı uçtan uca test edip kırık noktayı bulacak ve düzeltecek.

---

## SORUN

Beklenen akış:
```
Ödeme → promote → QC (10-30sn) → proof_generating → cutline (30-90sn) → proof_pending → /onay sayfası
```

Gerçekte olan:
```
Ödeme → ??? → status bir yerde takılıyor → kullanıcı /onay'a hiç ulaşamıyor
```

---

## ADIM 1 — Mevcut Siparişlerin Status'unu Kontrol Et

Supabase'den en son 10 siparişin status'unu çek:

```sql
SELECT id, status, created_at, updated_at
FROM orders
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
ORDER BY created_at DESC
LIMIT 10;
```

Veya admin API'den:
```bash
curl -s http://localhost:3000/api/admin/orders?limit=10 | jq '.orders[] | {id, status}'
```

Her siparişin status'unu not et — hangileri `paid`, `awaiting_upload`, `qc_pending`, `proof_generating`, `proof_pending`'de takılmış?

---

## ADIM 2 — Design Files Kontrol Et

Takılı siparişler için design_files tablosunu kontrol et:

```sql
SELECT df.id, df.order_id, df.order_item_id, df.status, df.original_name, df.created_at
FROM design_files df
WHERE df.order_id IN (
  SELECT id FROM orders
  WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
  ORDER BY created_at DESC LIMIT 5
)
ORDER BY df.created_at DESC;
```

Kontrol et:
- design_files var mı? (promote çalıştı mı?)
- status nedir? (`uploaded`, `analyzing`, `qc_passed`, `qc_failed`?)
- `qc_passed` ise neden order status ilerlemedi?

---

## ADIM 3 — QC Pipeline Test Et

Takılı bir sipariş için QC'yi manuel tetikle:

```typescript
// Test endpoint oluştur veya mevcut admin-bypass-promote'u kullan:
// POST /api/orders/admin-bypass-promote
// Body: { "orderId": "TAKILI_SIPARIS_ID" }
```

Console loglarını kontrol et:
- `[promote] orderItems with designTempId:` → kaç dosya promote ediliyor?
- `[promote] result promoted:` → kaç dosya promote edildi?
- `[promote] QC result:` → QC sonucu nedir?

---

## ADIM 4 — Akışın Her Noktasını Log'la

Aşağıdaki dosyalara **geçici** console.log ekle (sonra sil):

### 4a. Payment callback (normal ödeme akışı)
`src/app/api/payment/callback/route.ts`:
```typescript
// promoteOrderDesigns sonrası:
console.log("[payment-callback] promoted:", promotedCount, "orderId:", orderId);
// scheduleOrderDesignQC sonrası:
console.log("[payment-callback] QC scheduled for:", orderId);
```

### 4b. Admin bypass promote
`src/app/api/orders/admin-bypass-promote/route.ts`:
— Zaten loglar var, Vercel loglarını kontrol et.

### 4c. QC orchestrator
`src/lib/agents/run-order-qc.ts`:
```typescript
// Fonksiyon başlangıcı:
console.log("[run-order-qc] START orderId:", orderId);

// Design files sorgusu sonrası:
console.log("[run-order-qc] design_files count:", files.length, files.map(f => ({id: f.id, status: f.status})));

// Her QC sonrası:
console.log("[run-order-qc] file QC result:", fileId, verdict);

// Aggregate verdict sonrası:
console.log("[run-order-qc] aggregate verdict:", aggregateVerdict, "next status:", nextStatus);

// Status update sonrası:
console.log("[run-order-qc] status updated to:", nextStatus);
```

### 4d. Cutline generation (server-side)
`src/lib/agents/run-order-cutline.ts` (varsa):
```typescript
console.log("[cutline-gen] START orderId:", orderId);
console.log("[cutline-gen] items to process:", items.length);
console.log("[cutline-gen] result:", { generated, failed });
```

---

## ADIM 5 — End-to-End Test

Tüm logları ekledikten sonra:

1. Sticker konfigüre et (1 tasarım, kare, 50×50, 25 adet)
2. Tasarım yükle (küçük PNG, <1MB)
3. Sepete ekle
4. Admin bypass ile ödeme yap
5. Vercel loglarını (veya terminal loglarını) izle
6. Her adımda status'un ne olduğunu not et:

```
[T+0s]  Ödeme başladı → createCustomerOrder
[T+1s]  admin-bypass-promote çağrıldı
[T+2s]  promote result: X dosya
[T+3s]  QC başladı: run-order-qc START
[T+15s] QC sonuç: verdict=??, nextStatus=??
[T+16s] Status güncellendi: ??
[T+17s] Cutline generation başladı (varsa)
[T+60s] Cutline tamamlandı → status: proof_pending
```

---

## ADIM 6 — Kırık Noktayı Bul ve Düzelt

### Olası Kırık Nokta A: Promote çalışmıyor
**Belirti:** `design_files` tablosu boş
**Sebep:** `designTempId` order_items.meta'da yok veya `design_temp_uploads`'da kayıt yok
**Fix:** Konfigüratör → sepet → order arasında designTempId zincirini düzelt

### Olası Kırık Nokta B: QC çalışmıyor
**Belirti:** `design_files.status` = `analyzing` (hiç değişmemiş)
**Sebep:** `runOrderDesignQC` hiç tetiklenmedi veya hata verdi
**Fix:** QC tetikleme kodunu kontrol et, error handling ekle

### Olası Kırık Nokta C: QC çalışıyor ama GPT-4o hatası
**Belirti:** `design_files.status` = `analyzing`, order.status = `human_review`
**Sebep:** OpenAI API key eksik/hatalı, rate limit, veya circuit breaker açık
**Fix:** `.env` dosyasında `OPENAI_API_KEY` kontrol et, circuit breaker durumunu kontrol et

### Olası Kırık Nokta D: QC geçti ama status güncellenmedi
**Belirti:** `design_files.status` = `qc_passed` ama order.status hala `qc_pending`
**Sebep:** `run-order-qc.ts`'deki status update başarısız
**Fix:** DB update sorgusunu kontrol et

### Olası Kırık Nokta E: proof_generating'e geçti ama cutline üretilmedi
**Belirti:** order.status = `proof_generating`, cutline_designs tablosu boş
**Sebep:** Server-side cutline generation tetiklenmedi (Puppeteer)
**Fix:** `run-order-cutline.ts` çağrısını kontrol et

### Olası Kırık Nokta F: Cutline üretildi ama proof_pending'e geçmedi
**Belirti:** cutline_designs'da row var ama order.status hala `proof_generating`
**Sebep:** save-edit endpoint status güncellemedi
**Fix:** save-edit sonrası status transition kontrol et

---

## ADIM 7 — Fix Uygula ve Tekrar Test Et

Kırık noktayı bulduktan sonra:
1. Fix uygula
2. `npx tsc --noEmit` → 0 hata
3. Commit: `fix(flow): [kırık nokta açıklaması]`
4. ADIM 5'i tekrarla — bu sefer akış tamamlanmalı
5. `/onay/[orderId]` sayfasına ulaş — bıçak önizleme görünmeli

---

## ADIM 8 — Geçici Logları Temizle

Test başarılı olduktan sonra:
1. ADIM 4'te eklenen tüm `console.log` satırlarını sil
2. Commit: `chore: debug logları temizle`

---

## BAŞARI KRİTERİ

```
1. Sticker konfigüre et + tasarım yükle + sepete ekle ✅
2. Admin bypass ile ödeme yap ✅
3. /odeme-sonuc → hasDesigns=true ✅
4. /siparis/[id] → status ilerliyor (AI kontrol → bıçak → prova) ✅
5. 1-2 dakika içinde /onay/[id]'ye ulaşılabilir ✅
6. /onay/[id] → bıçak çizimi görünür ✅
7. "Bu ürünü onayla" butonu aktif ✅
```

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
