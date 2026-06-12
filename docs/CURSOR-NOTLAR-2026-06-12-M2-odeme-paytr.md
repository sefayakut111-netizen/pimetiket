# Cursor Notları — M2: Sepet & Ödeme (PayTR)

> Hata-tespit (P1). Boyut: D3 hata, D4 yarış/idempotency, D6 güvenlik, D7 para.
> **Genel:** Para akışı olgun ve savunmacı — sunucu fiyat recalc (`payment-validation.ts`), atomik finalize RPC (Mig 033, FOR UPDATE + `consumed` idempotency), kupon rezervasyonu (Mig 175), refund idempotency (Mig 069). Çift sipariş RPC kilidiyle önlenmiş. Asıl riskler: **token üretildikten sonra intent silme → orphan charge**, callback IP guard yokluğu, recover yolunda sessiz mismatch, refund toplam yarışı.

## 🔴 KRİTİK (para/sipariş kaybı)

### 1. init'te coupon reserve hatası → intent DELETE, ama PayTR token zaten canlı → orphan charge · D7/D4
- **Konum:** `init/route.ts:374-391` (token üret), `425` (intent insert), `446-474` (reserve sonra `456,469` delete)
- **Sorun:** Sıralama hatalı: token üret → intent insert → coupon reserve. Reserve başarısız/limit dolu olursa intent **siliniyor**. Müşteri elinde geçerli PayTR iframe URL'i ile ödemeye devam edebilir → callback gelir → intent yok → "OK" dönülür (retry yok) → **para alındı, sipariş yok**.
- **Düzeltme:** Reserve'i **token üretiminden ÖNCE** yap. Token üretildikten sonra herhangi bir hata yolunda intent'i SİLME — `failed`/`needs_review` işaretle ki callback bulabilsin.

### 2. Callback'te `intent_not_found` → "OK" dönülüyor → orphan charge sessizce kaybolur · D3/D7
- **Konum:** `callback/route.ts:197-218` (intentErr'de 200 "OK", `:217`)
- **Sorun:** Intent yoksa PayTR'ye "OK" → retry yapmaz. Ama #1 senaryosunda müşteri parası çekilmiş olabilir. Sentry+audit var ama otomatik kurtarma yok.
- **Düzeltme:** `intent_not_found`'da "OK" yerine kritik admin alarmı + reconciler kuyruğuna ekle (orphan charge taraması).

### 3. Callback'te IP allowlist yok — hash tek savunma · D6/D4
- **Konum:** `callback/route.ts:154-185` (POST guard yalnız `verifyCallback` hash)
- **Sorun:** IPN POST'unda IP/kaynak doğrulaması yok. `PAYTR_MERCHANT_KEY`/`SALT` herhangi bir log/env sızıntısında açığa çıkarsa saldırgan geçerli hash üretip `merchant_oid`+`status=success`+`total_amount` ile **PayTR'ye gerçek ödeme yapmadan** kendi intent'i için sipariş yarattırabilir (kendi OID'sini bilir → ücretsiz sipariş).
- **Düzeltme:** PayTR'nin yayınladığı IPN IP aralıklarını env allowlist'e koy; POST başında `getClientIp` kontrolü, dışındaysa 403+log. Defense-in-depth. (Doğrulama: PayTR statik IPN IP listesi yayınlıyor mu — Doğrulanacaklar #2.)

## 🟠 YÜKSEK

### 4. `abandon` ↔ `callback` yarışı + `expired` intent recover boşluğu · D4/D3
- **Konum:** `odeme/page.tsx:499-510` (mount'ta koşulsuz abandon, `:504`), `abandon-pending-checkout.ts:27-34`, `recover-pending-intent.ts:296-298`
- **Sorun:** `/odeme` mount'ta koşulsuz `abandonPendingCheckout()`. Kullanıcı PayTR'de ödeyip geri tuşuyla dönerse intent `expired` olur. IPN gelirse `fn_finalize_paid_order` `expired`'ı consume edip kurtarır (RPC yalnız `consumed` mı bakar). Ama `recover-pending-intent.ts:296` `status!=='pending'` ise erken `return {pending}` → browser/polling recover **çalışmaz**. IPN kaçarsa **sipariş açılmaz, para alınmış**.
- **Düzeltme:** Mount'ta koşulsuz abandon yapma — yalnız açık "vazgeç"te. recover'da `expired` intent için de PayTR durum sorgusu yapıp success ise finalize et.

### 5. Init'te eski pending intent süpersede edilince PayTR token iptal edilmiyor → iki canlı token · D4/D7
- **Konum:** `init/route.ts:335-357` (eski intent `expired`, PayTR'ye iptal çağrısı yok)
- **Sorun:** İkinci init'te eski iframe hâlâ açıksa orada ödenebilir → callback `expired` → #4. İki token = iki ödeme penceresi.
- **Düzeltme:** Callback'te `expired`+PayTR-success'i açıkça finalize et (orphan'ı siparişe çevir) + recover'ı `expired` için aç (#4 ile aynı fix).

### 6. `recover-pending-intent` amount mismatch'te sessiz `failed` — callback'in aksine alarm yok · D7/D3
- **Konum:** `recover-pending-intent.ts:142-149` vs `callback/route.ts:262-305`
- **Sorun:** Callback mismatch'te `needs_review`+Sentry+admin alarmı; recover yolunda yalnız `status='failed'`+sebep, **Sentry/admin alarmı yok**. Müşteri ödedi, tutar farklı → sessizce `failed`.
- **Düzeltme:** recover mismatch dalını callback ile eşitle (`needs_review`+Sentry+`notifyAdminCriticalAlert`).

### 7. Browser GET callback "pending"de `status=success&order=pending` döndürüyor → yanıltıcı başarı ekranı · D3/D7
- **Konum:** `callback/route.ts:631-635`
- **Düzeltme:** pending'de `status=pending` ile yönlendir; `/odeme-sonuc` zaten polling yapıyor.

## 🟡 ORTA

### 8. Duplicate IPN yolunda cart-clear/referral tekrar denenmiyor → ilk fail kalıcı · D3
- **Konum:** `callback/route.ts:412-422` (duplicate'te yalnız `ensureOrderDesignsPromoted`+return). İlk işlemde cart-clear (`478`)/referral (`468`) fail aldıysa kalıcı atlanır → sepet dolu kalır, müşteri aynı sepeti ikinci kez ödeyebilir.
- **Düzeltme:** Duplicate yolunda cart-clear'ı idempotent tekrar çağır.

### 9. `cart_items` delete hata kontrolsüz → başarısızsa çift sipariş kapısı · D4/D3
- **Konum:** `callback/route.ts:478` (`await ...delete()` hata kontrolü yok). Silinmezse müşteri tekrar ödeme başlatabilir → ayrı OID ile ikinci gerçek tahsilat.
- **Düzeltme:** delete hatasını logla+Sentry.

### 10. `parseInt(total_amount)` NaN guard'ı yok — `NaN > 1` false → mismatch'e takılmaz · D7
- **Konum:** `callback/route.ts:261,312` — bozuk `total_amount`'ta tutar doğrulaması atlanır. Hash `total_amount`'u koruduğu için pratikte engelli ama explicit guard yok.
- **Düzeltme:** `if (!Number.isFinite(incomingKurus)) → needs_review`.

### 11. `getClientIp` x-forwarded-for spoof — copyright_accept_ip FSEK ispat değeri zayıf · D6
- **Konum:** `init/route.ts:128-134, 421` — ham XFF'e güveniliyor.
- **Düzeltme:** Platform-spesifik trusted header (`x-vercel-forwarded-for`) kullan.

### 12. Refund toplam kontrolü yarışa açık — iki paralel kısmi iade charge'ı aşabilir · D4/D7
- **Konum:** `refund/route.ts:150-169` — `refundedSoFar` SELECT (`151`) ile placeholder INSERT (`204`) arası yarış; partial unique yalnız "processing" tekilliğini korur, toplam kontrolü atomik değil → **aşırı iade**.
- **Düzeltme:** Toplam iade kontrolünü RPC içinde charge satırını `FOR UPDATE` kilitleyerek atomik yap.

### 13. `total_uses_limit` rezervasyonu pending intent'te süresiz tutulabilir → kupon slot sızıntısı · D4
- **Konum:** Mig 175:135-155 (release yalnız `consumed/failed/expired` trigger'ında). Intent `pending` kalıp hiç callback/expire/abandon almazsa rezervasyon süresiz → başka müşteri kuponu kullanamaz.
- **Düzeltme:** Pending intent + rezervasyon için TTL (token timeout 30dk) sonrası otomatik expire eden cron/sweeper.

## 🟢 DÜŞÜK / OLUMLU
- **Olumlu:** `wallet_amount: 0` doğru (sefaRules uyumlu, `init:431`). KDV/yuvarlama tutarlı (`Math.round(amountTL*100)`, tolerans 0.05 TL). Kupon çift uygulama YOK (`coupon_uses unique(order_id)` + snapshot `chargedDiscount`). Finalize FOR UPDATE + `was_duplicate` çift siparişi engelliyor.
- **[KOZMETİK]** `buildBasket` her item'ı qty=1 gönderiyor (`paytr.ts:620-632`) — PayTR panel raporu yanıltıcı, `payment_amount` authoritative olduğu için tahsilat doğru.

## ❓ Doğrulanacaklar
1. **`fn_finalize_paid_order`** en güncel tanımı Mig 033 mü — `grep` 064/065/078/114'te de eşleşme; Mig 114 (`fn_create_order_lockdown`) / 078 finalize'ı override etmiş olabilir. `coupon_uses unique(order_id)` + intent FOR UPDATE son sürümde korunuyor mu (migration zinciri).
2. **PayTR IPN kaynak IP listesi** resmi yayınlanıyor mu (#3 allowlist için).
3. **`payment_intents` pending TTL** — başka cron/migration'da pending sweeper var mı (#13).
4. **#8 kupon duplicate** — `fn_apply_coupon_admin` `coupon_uses unique(order_id)` ihlalinde (duplicate IPN) ne döndürüyor; `applyCouponAfterOrder` exception'ı yutuyor (`coupon-server:180`) — duplicate'te sessiz geçer, kabul edilebilir ama teyit.

**En kritik:** #1+#2 (orphan charge — token sonrası intent silme/bulunamama) · #3 (IP guard) · #4+#5 (abandon-callback yarışı + expired recover) · #6 (recover sessiz mismatch) · #12 (refund aşımı).
