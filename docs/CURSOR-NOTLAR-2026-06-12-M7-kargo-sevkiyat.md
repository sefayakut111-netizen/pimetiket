# Cursor Notları — M7: Kargo & Sevkiyat

> Hata-tespit (P3). Boyut: D2 sözleşme, D3 hata, D4 yarış, D5 veri bütünlüğü. orders.status shipped/delivered drift M5'te.
> **KÖK SORUN:** Poll mantığı 3 yere kopyalanmış (cron / bulk-poll / tracking) → yarış + tutarsızlık; event dedup key'i eksik; bilinmeyen kargo durumu sessizce "Yolda".

## 🔴 KRİTİK

### 1. Event dedup key `(order_id,status,event_time)` — `assignment_id`/`raw_code` yok → tarihçe sessizce kayboluyor · D2/D4/D5
- **Konum:** `cron/poll-shipments/route.ts:134`, `bulk-poll/route.ts:111`, `tracking/route.ts:220`, `override/route.ts:118`
- **Sorun:** Aynı dakikaya düşen iki farklı şube event'i "duplicate" sayılıp kalıcı kaybolur; yeniden kargolamada (yeni assignment) eski event ezilebilir; override `event_time=now()` bir poll event'iyle çakışırsa gerçek event admin notuyla ezilir.
- **Düzeltme:** Conflict key'e `raw_status_code` (override için `ADMIN_OVERRIDE` zaten ayrıştırıcı) veya `assignment_id` ekle; event'leri append-only yap.

### 2. Poll cron ↔ manuel override/tracking last-writer-wins yarışı → durum geri sarması + çift mail · D4
- **Konum:** `cron/poll-shipments/route.ts:142-164` vs `override/route.ts:126-137`, `tracking/route.ts:225-232`
- **Sorun:** `tracking_status` UPDATE read-modify-write ama koşulsuz. Cron 50 kaydı ~250s işlerken admin `delivered` override basarsa cron stale yanıtla `in_transit`'e geri çeker. `oldStatus` snapshot ile UPDATE arası pencerede iki poll çakışırsa `statusChanged` yanlış → çift mail.
- **Düzeltme:** UPDATE'i `.eq("tracking_status", oldStatus)` CAS ile; transition+update tek RPC. `tracking_delivered_at IS NOT NULL` kaydı poll adayından kesin dışla. (Doğrulama #1.)

### 3. bulk-poll lock'suz + transition mantığı yok → cron ile eşzamanlı çift iş · D4
- **Konum:** `bulk-poll/route.ts:34-152` (lock yok), `cron/poll-shipments` (withCronRun var ama assignment-level lock yok)
- **Sorun:** İki admin bulk-poll veya cron+bulk-poll aynı assignment'a iki ardışık UPDATE + iki mail. bulk-poll'da `oldStatus`/transition mantığı **hiç yok** — status'u eziyor, cron'un mail kararını bozuyor.
- **Düzeltme:** Tek merkezi `pollAndPersist(assignmentId)` fonksiyonu; `tracking_last_polled_at` ile kısa claim (30sn) veya advisory lock; cron+bulk aynı fonksiyonu çağırsın (şu an 3 yerde kopyalı).

## 🟠 YÜKSEK

### 4. Bilinmeyen Yurtiçi durum kodu sessizce `in_transit`'e düşüyor → "Yolda" yanlış pozitif, failed mail gitmiyor · D2
- **Konum:** `lib/shipping/yurtici-api.ts:105, 176`
- **Sorun:** `normalizeYurticiStatus` bilinmeyen her metni `in_transit` döndürüyor. "Teslim edilemedi/iade/hasar" eşleşmezse müşteriye "Yolda" gösterilir, mail tetiklenmez (poll yalnız in_transit/failed/returned mail atıyor). `operationCode` sayısal kod hiç kullanılmıyor.
- **Düzeltme:** Bilinmeyeni `unknown` sentinel + log/alarm'a düşür; `operationCode`'u eşleme tablosuna kat.

### 5. `parseYurticiResponse` başarı kriteri `events.length>0` → şeması değişen yanıt sessizce bozulur · D2/D3
- **Konum:** `lib/shipping/yurtici-api.ts:282`
- **Sorun:** `operationCode=0` (başarı) olsa bile event bloğu parse edilemezse (Yurtiçi tag/namespace değiştirirse) `success=false`, `error` boş → poll yalnız `last_polled_at` günceller, uyarı yok. Regex parser namespace prefix'li tag'leri (`ns2:...`) yakalayamaz.
- **Düzeltme:** `success`'i `operationCode==0`'dan belirle; `events.length===0` ayrı `noData`. Parser'ı namespace-toleranslı (`(?:\w+:)?tag`). (Doğrulama #5.)

### 6. Manuel kargolama assignment'a `estimated_delivery` yazmıyor → SLA stats yanıltıcı · D5
- **Konum:** `tracking/route.ts:178-190` (insert'te yok) vs `stats/route.ts:230-250` (SLA bunu kullanıyor); `list/route.ts:103` `orders.estimated_delivery`'den okuyor (iki route iki kaynak)
- **Düzeltme:** Tek kaynak — her yerde `orders.estimated_delivery` (stats join ile) veya manuel kargolamada assignment'a kopyala. (Doğrulama #3.)

### 7. Label: tracking yoksa `cargoKey` her GET'te rastgele üretiliyor, kaydedilmiyor · D5/D2
- **Konum:** `admin/shipping/label/[orderId]/route.ts:99`, `generate-label.ts:321`
- **Sorun:** İki kez indirilirse iki farklı barkod; şube barkodu ile sistem kaydı eşleşmez. Barkod uzunluk/charset doğrulaması yok (tracking 64 char serbest, 100mm etikete sığmaz).
- **Düzeltme:** `cargoKey`'i assignment'a kalıcı yaz (ilk üretimde sabitle); barkod uzunluk/charset sınırı.

## 🟡 ORTA
- **8.** `event_time` timezone parse kırılgan (`yurtici-api.ts:257-265`) — format farklıysa 3 saat kayma → `avg_fulfillment_days`/geo `avg_days` saptırır; stats negatif gün filtrelemez (`stats:117-121`). → explicit parse + `deliv>ship` filtresi. · D5
- **9.** `shipments` list/geo N+1: satır başına `auth.admin.getUserById` (200/sayfa) + tüm event'leri çekip JS'te ilk'i alıyor (`route.ts:180-201`). → `listUsers`/RPC join + `DISTINCT ON`. · D3
- **10.** `IS_YURTICI_DRY_RUN` credential yoksa otomatik true → prod'da env eksikse sahte teslim event'i gerçek tabloya yazılır (`yurtici-api.ts:40-43,314-344`). → DRY_RUN'da DB yazımını atla; prod'da credential eksikse hard-fail. · D2/D5
- **11.** Override durum-makinesi doğrulaması yok; delivered olmayan override'da `tracking_delivered_at` temizlenmiyor → "delivered_at dolu ama status=returned" → stats iade'yi "teslim" sayar (`override/route.ts:55-60,126-132`). → delivered olmayan override'da `tracking_delivered_at:null` + geçersiz geçiş reddi. · D5/D2
- **12.** Poll filtresi serbest-metin `tracking_company` ("yurtiçi" içerir) üzerinden, `carrier_code` değil → bilinmeyen carrier code "yurtici" ama displayName "MNG" olursa poll atlar (`poll-shipments:108-111`, `carriers.ts:66-70`). → `carrier_code` ile filtrele. · D2
- **13.** Mail tetiği fire-and-forget (`void notif.send...`, hata yutuluyor) + `statusChanged` basit eşitlik → `in_transit↔out_for_delivery` salınımında çift mail (`poll-shipments:168-221`). → mail'i yeni-event'e bağla + idempotent anahtar (orderId+status). · D4/D3

## 🟢 DÜŞÜK
- **14.** Üst-seviye `operationCode` event-içi kodla karışabilir; SOAP-fault dışı hata kaçar (`yurtici-api.ts:390-403`). → envelope kapsamında ara.

## [KOZMETİK]
- `generate-label.ts:155` `dateText`/`headerRightText` sıralaması kafa karıştırıcı.
- `customer-shipment.ts:40-56` "N+1 önler" yorumu ama her id için ayrı RPC (N RPC).
- `geo-distribution.ts:46` `CITY_NORMALIZE`'da "bursa" — il istatistiği (Bursa yasağı pazarlama/persona içindir, ihlal değil ama not).
- `shipments/route.ts:131-133` `order_id` UUID'de `ilike` geniş eşleşme.

## ❓ Doğrulanacaklar
1. `fn_get_shipment_poll_candidates` `tracking_delivered_at IS NOT NULL` + son-poll filtresini uyguluyor mu (#2/#3 ciddiyeti).
2. `shipment_status_events` UNIQUE constraint gerçekte `(order_id,status,event_time)` mi `assignment_id` dahil mi (Mig 052) — eşleşmezse upsert runtime hata (#1).
3. `order_assignments.estimated_delivery` manuel kargolamada başka trigger ile doluyor mu (#6).
4. `trg_notify_customer_shipped` + `sendOrderShipped` çift mail üretiyor mu (1sa pencere yeterli mi) (#13).
5. Yurtiçi gerçek SOAP şeması (namespace/tag) regex parser ile uyumlu mu — prod'da DRY_RUN dışı test edilmemiş (#5/#14).

**En kritik:** #1 (event dedup kaybı) · #2+#3 (cron↔override/bulk yarışı, geri-sarma+çift mail) · #4 (bilinmeyen→Yolda) · #5 (parse sessiz bozulma). 3 route'taki kopya poll mantığını tek fonksiyona indirmek bulguların çoğunu kapatır.
