# Cursor Notları — M13: Cron & Arka Plan İşleri

> Hata-tespit (P3). Boyut: D1 akış, D3 hata/kısmi iş, D4 yarış, D6 güvenlik.
> **Genel:** CRON_SECRET guard tüm cron'larda var (`assertCronAuth` timing-safe — sağlam).
> **KÖK SORUN:** **Hiçbir cron'da gerçek tek-instance kilidi YOK.** `withCronRun` sadece log yazar, kilit değil; `cron_runs`'ta unique/partial index yok. Manuel tetikleyici bunu aktif olarak tetiklenebilir kılıyor.

## 🟠 YÜKSEK

### 1. `withCronRun` kilit DEĞİL — hiçbir cron'da tek-instance koruması yok · D4
- **Konum:** `lib/cron-logger.ts:61-75` + tüm cron uçları
- **Sorun:** `withCronRun` yalnız `cron_runs`'a "running" satırı insert edip handler çalıştırıyor; mevcut "running" kaydını kontrol etmiyor. Vercel cron + admin manuel tetik aynı anda → iki paralel çalışma. İdempotent OLMAYAN cron'larda (abandoned-cart, request-reviews, upload-reminders, instagram-sync, seo-indexing) çift mail/çift iş.
- **Düzeltme:** `withCronRun` başına `pg_try_advisory_xact_lock(hashtext(cronName))`; kilit alınamazsa `{skipped:"already_running"}`. Veya `cron_runs`'a `WHERE status='running'` partial unique.

### 2. `archive-inactive` race guard etkisiz — koşulsuz UPDATE · D4
- **Konum:** `lib/storage/archive-service.ts:91-100` (cron: `archive-inactive/route.ts:75-81`)
- **Sorun:** Yorum "race koruması" ama `update({archive_status:"archiving"}).eq("id",userId)` koşulsuz — zaten "archiving" olsa bile geçer. İki paralel run aynı müşteriyi R2'ye iki kez yazar (çift upload, çift totalBytes).
- **Düzeltme:** `.eq("id",userId).neq("archive_status","archiving")` + `.select()` ile etkilenen satır kontrolü; 0 ise atla (CAS). (Doğrulama #2.)

### 3. `archive-inactive` kısmi iş — batch item patlarsa yarım arşiv · D3
- **Konum:** `archive-inactive/route.ts:75-81` (`archiveCustomer` try/catch'siz döngüde)
- **Sorun:** Beklenmedik throw'da tüm cron düşer; `archive_status="archiving"` yapılmış ama tamamlanmamış müşteriler "yarım arşiv" (R2 kısmi obje, DB askıda). 300s maxDuration aşımında da aynı.
- **Düzeltme:** Her çağrıyı try/catch ile sar; başarısızda rollback/`archive_failed`; tamamlanınca net status.

### 4. `detect-abandoned-carts` idempotency key tutarsızlığı → çift mail · D4
- **Konum:** `detect-abandoned-carts/route.ts:127-143` vs `sendAbandonedCart`
- **Sorun:** Idempotency `abandoned_cart:${uid}:${dayKey}` (gün dahil) ararken dedup penceresi 7 gün → key her gün değişir, yalnız bugünküyle eşleşir → "7 günde gönderildi mi" çalışmaz → 7 gün içinde tekrar mail. `sendAbandonedCart`'ın aynı key formatını yazıp yazmadığı da doğrulanmalı (yazmıyorsa her gün mail).
- **Düzeltme:** Key'den `dayKey` çıkar (`abandoned_cart:${uid}`), `sendAbandonedCart` ile birebir aynı format. (Doğrulama #1 — KRİTİK'e yükselebilir.)

### 5. Manuel tetikleyici çift-çalışmayı tetikler · D4
- **Konum:** `admin/cron-status/trigger/route.ts:57-61` — herhangi cron'u CRON_SECRET ile çağırıyor; Vercel cron saatine denk gelirse #1 ile garanti çift-çalışma. Throttle/"running mı" kontrolü yok.
- **Düzeltme:** Tetik öncesi son N dk "running" varsa 409; #1 advisory lock bunu çözer.

### 6. `request-reviews` `updated_at` penceresi → review maili hiç gitmeyebilir · D1
- **Konum:** `request-reviews/route.ts:52-58`
- **Sorun:** "7-21 gün önce teslim" için `updated_at` kullanıyor ama teslimden sonra herhangi update `updated_at`'i ileri taşıyıp siparişi pencereden düşürür → mail gitmez.
- **Düzeltme:** `delivered_at` (veya `order_events` teslim timestamp) kullan. (Doğrulama #4.)

### 7. `upload-reminders` 24sa pencere + günlük cron → cron jitter'da tekrar mail · D1/D4
- **Konum:** `upload-reminders/route.ts:97-109` — cron jitter/manuel tetikte aynı siparişe 2 gün üst üste; `awaiting_upload` 14 güne kadar açık → ~14 mail.
- **Düzeltme:** Ürün kararı "her gün" mü "tek" mi netleştir; tek ise `reminded_at` kolonu. (Doğrulama #7-product.)

## 🟡 ORTA
- **8.** `admin-daily-summary` N+1 sıralı count + `maxDuration` yok → timeout'ta mail gitti ama `cron_runs` "running" kalır (`route.ts:85-159`). → `Promise.all` + `maxDuration=60` + stale-reaper. · D3
- **9.** `seo-indexing` `Promise.all` (biri reject→tümü düşer) + `ok = indexNow.ok || gsc.ok` (OR) → GSC sürekli fail'de health yeşil (`seo-indexing/route.ts:23-33`). → `allSettled` + `&&`. · D3
- **10.** Auditor cron'larda `maxDuration` yok (`auditors/[name]/route.ts`) → ağır auditor timeout, `cron_runs` "running" kalır. → `maxDuration=120`. · D3
- **11.** `paytr-reconciler` recover sonrası onay maili fire-and-forget (`void send...catch`) → serverless freeze'de mail kaybı (para kurtarıldı, müşteri habersiz) (`paytr-reconciler/route.ts:232-251`). → `enqueueMail` (outbox) deseni. · D3
- **12.** `cron_runs` "running" temizleyici yok → timeout/crash'te kalıcı "running", health yalnız `status='error'` sayar → timeout'lu cron "healthy" görünür (`cron-logger.ts:38-50`, `cron-health.ts:59-73`). → >2x maxDuration "running"→"stalled"+error. · D3
- **13.** Instagram token Pazar-only refresh, 60g token tek nokta hata; `instagram-sync` "missing_token"'ı sessiz skip (`cron-registry.ts:24-27`, `instagram-sync/route.ts:25-26`). → TTL<14g admin uyarı + skip warning-level. · D1

## 🟢 DÜŞÜK
- **14.** `detect-abandoned-carts` per-user `getUserById` N+1 (100 seri auth çağrısı) + `maxDuration` yok (`:169`). → `profiles` batch + `maxDuration=60`. · D3
- **15.** `request-reviews`/`detect-abandoned-carts` idempotency key `:` split parse kırılgan (`request-reviews:109-113`). → `target_id`/kolon üzerinden eşleştir. · D1

## [KOZMETİK]
- `cron-registry.ts`↔`vercel.json` elle senkron, otomatik doğrulama testi yok — cron eklenip registry'ye yazılmazsa health izlemez.
- `admin-daily-summary/route.ts:69-176` girinti tutarsız.
- `approval-reminder/route.ts:142` farklı response şekli (`payload.data ?? payload`) — tutarsız sözleşme.

## ❓ Doğrulanacaklar
1. `sendAbandonedCart` gerçekte hangi idempotency_key formatını yazıyor (#4 — eşleşmezse her gün çift mail → KRİTİK).
2. `get_archive_candidates` `archive_status` filtreliyor mu (#2/#3).
3. Auditor base `run()` check-içi hata izolasyonu yapıyor mu (#10).
4. `orders.delivered_at` kolonu var mı (#6).
5. Vercel plan Hobby mi Pro mu — `maxDuration=300` cron'lar Hobby'de kesilir (kısmi iş garantili).

**En kritik:** #1 (tek-instance kilidi yok) + #5 (manuel tetik bunu tetikler) → #4/#7 çift mail, #2/#3 çift R2/yarım arşiv. İkincil: #8/#12 "running" kayıt temizliği yok → sahte sağlık.
