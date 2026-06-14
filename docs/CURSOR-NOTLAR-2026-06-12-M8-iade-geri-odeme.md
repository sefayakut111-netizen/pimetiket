# Cursor Notları — M8: İade & Geri Ödeme

> Hata-tespit (P2). Boyut: D1 akış/FSM, D4 yarış, D6 yetki, D7 para. PayTR refund saf para-mekaniği M2'de.
> Durum makinesi: `pending → approved/rejected → refunded`. DB: `returns` (Mig 003), partial unique (Mig 125), SLA RPC (Mig 131 override).
> **KÖK SORUN:** İade durum makinesinde geçiş validasyonu yok + `refunded` gerçek para iadesi olmadan set edilebiliyor + "baskı sonrası iade yok" kuralı UI'ın `force:true`'su ile tamamen bypass.

## 🟠 YÜKSEK

### B1. Durum makinesinde geçiş validasyonu YOK — reopen + terminal dirilme + atlama + yarış · D1/D4
- **Konum:** `api/admin/returns/[id]/status/route.ts:50-92`
- **Sorun:** `existing.status` çekiliyor ama hedef geçiş geçerliliği kontrol edilmiyor; `update().eq("id",returnId)` koşulsuz. → `refunded` (terminal) tekrar değiştirilebilir, `rejected` tekrar `approved` (reopen, müşteriye tekrar mail), `pending→refunded` atlama. `.eq("status",expectedCurrent)` CAS-lock yok → iki admin yarışında son yazan kazanır.
- **Düzeltme:** İzinli geçiş haritası (`pending→{approved,rejected}`, `approved→{refunded,rejected}`, rejected/refunded terminal); geçersizse 409. `.eq("status",row.status)` CAS, 0 satır→409.

### B2. `refunded` gerçek para iadesi OLMADAN set edilebiliyor — sahte "iade tamamlandı" · D7/D1
- **Konum:** `api/admin/returns/[id]/status/route.ts:15, 78-87`
- **Sorun:** Route `status:"refunded"` kabul edip satırı `refunded` yazıyor ama **PayTR refund çağrılmıyor, `payments`'a kayıt girmiyor, `refund_payment_id` set edilmiyor**. Gerçek para yalnız ayrı `/api/payment/refund`'tan. İki "refunded'a geçiren" yol senkronize değil. UI bu route'tan refunded tetiklemiyor ama uç açık.
- **Düzeltme:** `status` route'undan `"refunded"` enum'unu kaldır; refunded'a geçiş yalnız `/api/payment/refund` başarı yolundan.

### B3. `payment/refund` returns durumunu doğrulamıyor — pending/rejected doğrudan refunded'a atlanır · D1/D7
- **Konum:** `api/payment/refund/route.ts:310-319`
- **Sorun:** `returnId` verilince satır `refunded` yazılıyor ama returnId'nin bu order'a ait olduğu ve mevcut status'ünün `approved` olduğu kontrol edilmiyor → admin `pending`/`rejected` talebi doğrudan iade edebilir; "ürün geri geldi mi" kuralı atlanır; başka order'ın talebi bile refunded yazılır (çapraz-order).
- **Düzeltme:** Refund öncesi `returns` çek; `order_id===orderId` ve `status==="approved"` doğrula, değilse 409; update'i `.eq("status","approved")` ile koşulla.

### B4. Admin iade UI her zaman `force:true` → "baskı sonrası iade yok" kuralı tamamen bypass · D7/D1
- **Konum:** `app/admin/iadeler/page.tsx:153` (`force:true`) vs `payment/refund/route.ts:96-105` (`POST_PRODUCTION_STATUSES` 422 koruması)
- **Sorun:** Refund route'ta in_production/shipped/delivered için 422 koruması var ama admin panelin tek refund butonu koşulsuz `force:true` yolluyor → Sefa "baskıdan sonra iade yok" kuralı her iade talebinde devre dışı. Audit `postProductionForced` işaretler ama ikinci kapı yok.
- **Düzeltme:** UI önce `force` olmadan dene; 422'de açık uyarı modalı + gerekçe al, sonra `force:true`. Otomatik force kaldırılmalı.

### B5. İade tutarı serbest admin prompt'u; kargo/KDV/kısmi-iade iş kuralı yok · D7
- **Konum:** `api/payment/refund/route.ts:142-169`; tutar `app/admin/iadeler/page.tsx:127` serbest `prompt`
- **Sorun:** Üst sınır yalnız PayTR `charge.amount`; iade tutarı admin'in elle girdiği değer. Kargo iade kapsamı, KDV, ürün-bazlı kısmi iade kuralı yok. `returns.refund_amount` ↔ `payments` refund ayrı yollardan (B2) tutarsız kalabilir. (Çift-iade üst-sınırı `refundedSoFar+amount>charge.amount` doğru çalışıyor.)
- **Düzeltme:** Tutarı sunucuda order kalemleri+kargo politikasından hesapla veya en azından `remaining=charge.amount-refundedSoFar`'ı UI'da göster; serbest prompt'u kaldır.

## 🟡 ORTA

### B6. auto-refund SLA `proof_uploaded_at IS NOT NULL` şartı — NULL olan eski siparişler hiç tetiklenmez · D7/D1
- **Konum:** `migrations/131_proof_sla_proof_uploaded_at.sql:23-24,37-39`; route `auto-refund/route.ts:289-291`
- **Sorun:** Aktif RPC `proof_uploaded_at` kullanıyor + NOT NULL şartı. Mig 172 backfill trigger ekliyor ama trigger öncesi proof_pending'e girmiş eski siparişlerde NULL kalmış olabilir → SLA kaskadına hiç girmez (ne hatırlatma ne iade). Route yorumu hâlâ "updated_at" anlatıyor (kod-yorum drift).
- **Düzeltme:** NULL `proof_uploaded_at` proof_pending için tek seferlik backfill (`=coalesce(proof_uploaded_at,updated_at)`); yorumu güncelle. (Doğrulama #1.)

### B7. auto-refund reminder claim-then-act değil → çift cron çift hatırlatma · D4
- **Konum:** `auto-refund/route.ts:286,301-307` — refund tarafı sabit idempotency_key ile korunuyor (iyi); reminder yalnız "24h içinde event yok" SQL'iyle, claim yok → paralel cron çift mail.
- **Düzeltme:** `withCronRun` tek-instance kilidini doğrula; reminder için claim-then-act (`proof_reminder_sent` event `on conflict do nothing`, başarılıysa mail).

### B8. processRefund rollback `cancelled→proof_pending` SLA'yı sonsuz retry'a sokuyor · D1/D4
- **Konum:** `auto-refund/route.ts:161-178, 201-206` — PayTR reddinde order proof_pending'e geri alınıyor ama `proof_uploaded_at` aynı → sonraki cron yine 36h+ görür → sonsuz başarısız PayTR call + `failed` kaydı birikir.
- **Düzeltme:** Tekrarlayan reddte `cancelled` bırak + `refund_manual_required` event; retry sayacı/cooldown.

### B9. `me/returns` çift-submit: DB unique kurtarıyor ama hata mesajı yanlış (500) · D4
- **Konum:** `api/me/returns/route.ts:75-106`; DB Mig 125 partial unique
- **Sorun:** Uygulama "pending var mı" SELECT→INSERT (TOCTOU); DB partial unique ikinci insert'i 23505 ile keser (sağlam) ama route yakalamıyor → generic `return_create_failed` (500); kullanıcı "zaten talep var" yerine sistem hatası görür.
- **Düzeltme:** `code==="23505"`→409 `return_already_pending`.

### B10. auto-refund yan etkiler best-effort — para iade edildi ama event eksik kalabilir · D4/D7
- **Konum:** `auto-refund/route.ts:227-278` — refund success sonrası `logOrderEvent` throw ederse boundary yutuyor, refund zaten yapılmış → muhasebe/denetim izi tutarsız.
- **Düzeltme:** Event insert'ini refund-success sonrası önce/atomik yap, mail en sona.

### B11. `admin/returns/[id]/status` order_events insert hatası yutuluyor · D1
- **Konum:** `:121-135` — durum değişti ama audit eventi eksik kalabilir, route yine `ok:true`. → insert error logla/RPC'ye al.

### B12. İade sonrası `orders.status` güncellenmiyor — M5 ile tutarsızlık · D1
- **Konum:** `api/payment/refund/route.ts` (orders update yok), `admin/returns/[id]/status` (yok) — tam iade edilmiş sipariş hâlâ `delivered` görünür; raporlar aktif sayar. (auto-refund yolu `cancelled` yapıyor, tutarlı; tutarsızlık manuel iadede.)
- **Düzeltme:** Tam iadede order'ı `cancelled`/`refunded`'a çek (M5 enum); kısmi iadede event yeterli mi netleştir. (Doğrulama #3.)

## 🟢 DÜŞÜK
- **B13.** `me/returns` `customerName`/`customerEmail` body'den (spoof) — `user_id` IDOR korumalı ama snapshot doğrulanmıyor (`:30-32,94-95`). → `user.email`/profiles'tan doldur. · D6
- **B14.** `in_production` ELIGIBLE ama refund'da POST_PRODUCTION bloklu — kavramsal tutarsızlık (`me/returns:13-17` vs `refund:33-38`). · D1
- **B15.** `admin/payments/refund` self-fetch ile `/api/payment/refund` (cookie forward + origin riski); audit `res.ok` öncesi yazılıyor (`:67-88`). → ortak lib fonksiyonu. · D4/D6

## [KOZMETİK]
- B16: `auto-refund/route.ts:6-8` başlık yorumu eski mantığı (updated_at, 12/36sa) anlatıyor; aktif RPC Mig 131 (proof_uploaded_at).
- B17: `customer-return.ts:226-312` guest/localStorage iade akışı — auth-only sistemde ölü/yanıltıcı (login'de kaybolur).

## ❓ Doğrulanacaklar
1. Production'da `proof_uploaded_at IS NULL` olan `proof_pending` sayısı (B6).
2. `withCronRun` gerçek tek-instance advisory lock sağlıyor mu (B7).
3. M5'te tam iade sonrası beklenen `orders.status` (B12).
4. `returns.refund_amount` "KDV dahil" mi; kargo iade politikası (B5).
5. `admin/payments/refund` self-call origin prod'da doğru host mu (B15).

**En kritik:** B1 (geçiş validasyonu yok) · B3+B2 (approved kontrolsüz/parasız refunded) · B4 (force:true ile baskı-sonrası-iade bypass).
