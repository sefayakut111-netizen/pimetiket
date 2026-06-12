# Cursor Görev Notları — Üretim Partneri (Fason) Hafriyatı (12 Haziran 2026)

> **Amaç:** Üretim partneri (fason) tarafının üç açıdan derin denetimi: (A) Yetkilendirme & IDOR,
> (B) Müşteri verisi gizleme / KVKK, (C) Atama durum makinesi & audit bütünlüğü. Her bulgu Cursor'a
> doğrudan görev olarak verilebilecek formatta: konum (`dosya:satır`), sorun, somut düzeltme.
> Satır numaraları commit `323943b` itibarıyladır.
>
> **Genel tablo:** IDOR koruması ve token mimarisi sağlam çıktı. Asıl açıklar üç yerde:
> **(1) OTP girişi** (brute-force/enumeration), **(2) redaksiyon yapılmayan komşu alanların partnere
> — özellikle auth'suz public token ucuna — sızması**, **(3) pause/terminate'in gerçek koruma ve
> audit sağlamaması + durum makinesi delikleri.**

---

## 🔥 En acil 6 iş (özet)

| # | Bulgu | Neden acil |
|---|---|---|
| 1 | **B1+B2+B3** — `meta`/`notes`/`config` HAM olarak, **auth'suz `info/[token]`** ucuna sızıyor | Müşteri dosya adı + admin serbest notu (PII) kimlik doğrulamasız ifşa |
| 2 | **C1** — pause/terminate edilen partner üretime devam edebiliyor | Durdurulmuş partner siparişi `shipped`'e kadar götürüyor |
| 3 | **A1** — `otp-verify`'da brute-force koruması yok | 6 haneli OTP'ye sınırsız deneme |
| 4 | **C3** — "issue" durumu kalıcı ölü-kilit | Sorun bildirilen atama bir daha ilerletilemiyor, kapasiteyi işgal ediyor |
| 5 | **B4** — `shipping-info` gerçek ad/telefon/adres döndürüyor, redakte etiket yok | "Model B = partner kimliği görmesin" hedefiyle çelişiyor |
| 6 | **C2** — pause/terminate/resume audit yazmıyor | Kalıcı aksiyonlar "kim/ne zaman/neden" izi bırakmıyor |

### Önerilen PR paketleme
- **PR-1 (B1+B2+B3+B5+B6):** Partner payload redaksiyonu — `redactItemMetaForPartner` whitelist + `notes` kaldır + dosya adı nötrle. **En öncelikli.**
- **PR-2 (C1+C2+C6):** pause/terminate gerçek koruma + audit + no-op düzeltme.
- **PR-3 (A1+A2+A3):** OTP sertleştirme — verify rate-limit + enumeration kapatma + serverless limiter.
- **PR-4 (C3):** issue durumundan çıkış aksiyonu.
- **PR-5 (C4+C5+C7):** Yarış durumları → koşullu update / RPC transaction.
- **PR-6 (B4):** Model B redakte kargo etiketi (ürün kararı gerektirir).

---

# A) YETKİLENDİRME & IDOR

> **Pozitif:** Tüm order/item route'ları `assertActivePartnerAssignment` ile DB seviyesinde aktif atama doğruluyor — atlanmış route yok. Token: 128-bit entropi, hash-only saklama, expiry+revoke+use-count, tek siparişe bağlı. IDOR yüzeyi temiz.

### A1. [KRİTİK] `otp-verify`'da uygulama seviyesi brute-force koruması yok
- **Konum:** `src/app/api/partner/auth/otp-verify/route.ts:36-73`
- **Sorun:** `otp-request`'te IP (10) ve email (5) rate-limit var ama `otp-verify`'da HİÇ yok. Tek OTP isteğinden sonra sınırsız `{email, token}` denemesi gönderilebilir; OTP 6 hane (1M kombinasyon). Tek savunma Supabase'in kendi sayacı — kod garanti etmiyor.
- **Düzeltme:** `rateLimit({ key:'partner-otp-verify:email:'+email, limit:5, windowMs:15*60_000 })` + IP bazlı limit ekle; aşılınca pending OTP'yi geçersiz kıl.

### A2. [YÜKSEK] OTP enumeration: `role_conflict`/`duplicate_partner_email` varlık sızdırıyor
- **Konum:** `src/app/api/partner/auth/otp-request/route.ts:113-126, 153-174`
- **Sorun:** `GENERIC_RESPONSE` tasarlanmış ama dallar sapıyor: müşteri email → 409 `role_conflict`, admin/staff → `role_conflict_privileged`, çoklu partner → `duplicate_partner_email`. Saldırgan bir email'in müşteri/admin/partner olduğunu ayırt eder (admin email tespiti için değerli).
- **Düzeltme:** Tüm "kayıtlı ama çakışma" durumlarında istemciye `GENERIC_RESPONSE` dön; gerçek ayrımı sadece audit_log'a yaz.

### A3. [YÜKSEK] In-memory rate-limit fallback serverless'te etkisiz
- **Konum:** `src/lib/rate-limit.ts:158-165` + `otp-request/route.ts:46-90`
- **Sorun:** Upstash env yoksa `memoryStore` (Map) kullanılıyor; Vercel'de her lambda kendi belleğine sahip, soğuk start'ta sıfırlanır → IP/email limitleri pratikte uygulanmaz. A1 ile birleşince OTP brute-force riski büyür.
- **Düzeltme:** Production'da Upstash (veya DB tabanlı sayaç) zorunlu; `UPSTASH_*` yoksa OTP uçlarında fail-closed davran.

### A4. [YÜKSEK] `otp-request` login'siz user+profile oluşturuyor
- **Konum:** `src/app/api/partner/auth/otp-request/route.ts:179-216`
- **Sorun:** `partner_contacts`'ta email'i olan biri için login OLMADAN `auth.admin.createUser` + `profiles.upsert({role:'partner'})` çalışıyor. A3 ile birlikte spam'le gereksiz user/profile yazımı + `email_confirm:true` ile hesap ön-provizyonu.
- **Düzeltme:** User/profile oluşturmayı başarılı OTP doğrulaması SONRASINA (verify route'una) ertele; request sadece "contact var mı" + OTP gönderimi yapsın.

### A5. [ORTA] `settings`/`verify-email`: kullanıcının contact'ı yoksa "owner" contact'a düşüyor (partner-içi yatay yetki)
- **Konum:** `src/app/api/partner/settings/route.ts:110-118, 213-221`; `verify-email/route.ts:50-58`
- **Sorun:** `user_id` eşleşen contact bulunamazsa `role='owner'` contact'a fallback yapıp onun adına ad/telefon/email değişikliği (email doğrulama dahil) başlatıyor → partner-içi yetkisiz contact, owner'ın profilini değiştirebilir.
- **Düzeltme:** Fallback'i kaldır; sadece `user_id = ctx.userId` eşleşen contact üzerinde işle, yoksa 404.

### A6. [ORTA] `fason/download` rate-limit yok + `max_use_count` default 200 çok yüksek
- **Konum:** `fason/download/[token]/route.ts:17-19`; `supabase/migrations/132_fason_token_max_use.sql:4`
- **Sorun:** Download'da rate-limit yok; token sızarsa 200 kullanıma + 7-14 gün boyunca tasarım dosyaları indirilebilir.
- **Düzeltme:** `max_use_count`'u ~50'ye çek; IP bazlı rate-limit ekle; şüpheli IP çeşitliliğinde token otomatik revoke.

### A7. [DÜŞÜK] Partner-facing route'lar service-role (RLS bypass) kullanıyor — mimari kırılganlık
- **Konum:** `src/lib/supabase/partner-auth.ts:36-58` + tüm partner route'ları
- **Sorun:** RLS savunma katmanı devre dışı; IDOR kontrolleri elle (`assertActivePartnerAssignment`). Bir route'ta `assert` unutulursa tam cross-tenant açılır. Şu an unutulan yok.
- **Düzeltme:** Yeni route eklerken `assert` zorunluluğunu lint/test ile garanti et; mümkünse okuma sorgularını RLS'li authenticated client'a taşı.

### A8. [DÜŞÜK] IP kaynağı tutarsız: rate-limit XFF-son, audit XFF-ilk (spoofable)
- **Konum:** `rate-limit.ts:168-177` (last) vs `download/[token]/route.ts:28-31`, `fason/update/route.ts:96` (first)
- **Sorun:** Audit logları XFF'in başından IP alıyor (saldırgan sahteleyebilir) → adli iz güvenilmez.
- **Düzeltme:** Tüm IP çıkarımını tek `getClientIp` helper'ına (güvenilir uç) standartla.

### A9. [DÜŞÜK] Başarısız OTP doğrulamaları loglanmıyor (anomali sinyali yok)
- **Konum:** `otp-verify/route.ts:99-116` — sadece başarı `last_login_at` yazıyor.
- **Düzeltme:** Başarısız verify'ları audit_log'a yaz; eşik aşımında contact'ı geçici kilitle.

---

# B) MÜŞTERİ VERİSİ GİZLEME / KVKK

> **Pozitif:** `redactOrderAddressForPartner` (`redact-order-address.ts:2-15`) **whitelist tabanlı ve doğru** — sadece `city`/`district` çekiyor, ad/telefon/sokak/fatura otomatik düşüyor. Mail şablonları temiz. `buildOrderPrintUrls` yalnız admin-guard'lı.
> **Sorun:** Redaksiyon yapılmayan KOMŞU alanlar partnere — özellikle **auth'suz `info/[token]` ucuna** — ham gidiyor.
>
> `address` JSON shape (`customer-order.ts:31-37`): `{ label?, name, addr, city, phone }`.

### B1. [KRİTİK] `order_items.meta` partnere HAM dönüyor — müşteri dosya adı/önizleme URL'i sızıyor
- **Konum:** `src/app/api/partner/orders/[id]/route.ts:211` (`meta: it.meta`); `src/app/api/fason/info/[token]/route.ts:71-72`
- **Sorun:** `meta`, `buildOrderItemMeta` (`order-item-meta.ts:39-73`) ile `...(item.meta ?? {})` spread ediyor + `designFileName`, `designPreviewUrl` içeriyor. Müşteri dosya adı çoğu kez PII ("ahmet-yilmaz-dugun-davetiyesi.pdf"). Redaksiyonsuz partnere (authenticated + public token) gidiyor.
- **Düzeltme:** `redactItemMetaForPartner()` whitelist'i ekle; yalnız üretim alanları (`shape, cut, material, finish, winding, coreSize, rollLabelCount`). `designFileName`/`designPreviewUrl` ve bilinmeyen spread alanları dışarıda bırak.

### B2. [KRİTİK] `assignment.notes` partnere dönüyor — serbest admin notu PII taşıyabilir
- **Konum:** `src/app/api/partner/orders/[id]/route.ts:251`; `info/[token]/route.ts:58,87`; kaynak `admin/fason/assign/route.ts:76,120`
- **Sorun:** `order_assignments.notes` admin'in girdiği 1000 karakterlik serbest metin. "Müşteri Ahmet Bey, 0532... arayın" gibi PII rahatlıkla yazılabilir, redaksiyonsuz partnere aktarılıyor.
- **Düzeltme:** `notes`'u partner payload'ından çıkar veya ayrı "partner_instructions" alanına taşı; serbest admin notunu partner kanalından kaldır.

### B3. [KRİTİK] Auth'suz `info/[token]` ucu adres dışı alanları redakte etmiyor
- **Konum:** `src/app/api/fason/info/[token]/route.ts:55-98`
- **Sorun:** Public token ucu; adres redakte edilmiş (satır 92, doğru) ama aynı yanıtta `notes` (B2), `meta` (B1), `config` (B5) HAM. Token sızarsa (mail, log, geçmiş) kimlik doğrulamasız ifşa. En katı redaksiyon gereken yer, en eksik olanı.
- **Düzeltme:** Token ucunda da B1/B2 whitelist'ini uygula; public yüzeyde en dar payload prensibi.

### B4. [YÜKSEK] `fullOrderAddressForPartnerShipping` gerçek ad+telefon+tam adres döndürüyor; redakte etiket yok
- **Konum:** `src/lib/fason/redact-order-address.ts:27-60` + `shipping-info/route.ts:120-158`; gating `partner-shipping-access.ts:2-5`
- **Sorun:** Model B gereği kasıtlı ama TÜM koruma tek status kontrolüne (`ready`/`in_production`) bağlı. `recipientName` (gerçek isim), `phone`, `addressLine` (tam sokak) dönüyor — "partner kimliği görmesin" kuralının tam istisnası. Redakte kargo etiketi mantığı YOK; status whitelist gevşerse tüm PII açılır.
- **Düzeltme:** Model B "partner müşteri kimliğini görmesin" ise bu uç taşıyıcı API'sinden alınan anonim gönderi kodu/redakte etiket döndürmeli. En azından erişimi audit + zaman pencereli kıs; status whitelist'i tek kaynak olarak code-review zorunluluğuna bağla.

### B5. [YÜKSEK] `items[].config` serbest string, redaksiyon yok
- **Konum:** `orders/[id]/route.ts:208`; `info/[token]/route.ts:71`; kaynak `customer-cart.ts:43`
- **Sorun:** Bugün teknik ("60×60mm · Yuvarlak") ama serbest string; kişiselleştirme/not buraya akarsa redaksiyonsuz partnere gider.
- **Düzeltme:** `config`'i yapılandırılmış alanlardan (width/height/shape/material) partnere yeniden türet; ham string'i geçirme.

### B6. [YÜKSEK] Tasarım dosya adı (`original_name`) partnere + loglara akıyor
- **Konum:** `orders/[id]/route.ts:196` (`file_name: df.original_name`); `download/[token]/route.ts:114-116, 151, 155-156`
- **Sorun:** Müşteri dosya adı PII içerebilir; partner UI'ında, indirilen dosya adında ve `order_events`/`fason_link_access_log`'da görünüyor. İndirilen dosya partnerin diskinde PII olarak kalır.
- **Düzeltme:** Partnere nötr ad ver (`siparis-{orderId}-tasarim-v{version}.pdf`); loglarda `design_file_id` kullan; UI'da dosya adını gösterme/redakte et.

### B7. [ORTA] Redaksiyon ↔ shape uyumsuzluğu: `district`/`postal`/`zip` checkout'ta yok
- **Konum:** `redact-order-address.ts:10-13` (`addr.district`), `45-50` (`addr.postal/zip`); gerçek shape `customer-order.ts:31-37`
- **Sorun:** Doğrudan sızıntı değil ama redaksiyon doğruluğu sorunu: `district` hep `null` dönüyor. Daha önemlisi `city` serbest girilmişse tüm adres içerip "sadece şehir" varsayımını bozabilir.
- **Düzeltme:** Adres modelini redaksiyon fonksiyonlarıyla hizala; `city`'nin yapılandırılmış il olduğunu doğrula/normalize et.

### B8. [ORTA] `shipping-info` audit log'da `actor_email: null` — PII erişim izlenebilirliği eksik
- **Konum:** `shipping-info/route.ts:144-150`
- **Sorun:** Tam adres görüntüleme audit'leniyor ama `actor_email`/`actor_role` null; hangi partner hesabının müşteri adresini gördüğü e-posta düzeyinde kayıtlı değil (KVKK denetim izi zayıf). *(A grubunda da aynı bulgu.)*
- **Düzeltme:** `ctx`'ten partner email'ini çöz, `actor_email`/`actor_role` doldur.

### B9. [ORTA] `console.error` ham Supabase hata objesini logluyor — PII riski
- **Konum:** `partner/orders/route.ts:118`; `shipping-info/route.ts:47,51`; `download/[token]/route.ts:119`
- **Sorun:** Supabase hata objeleri sorgu detayı/satır verisi içerebilir; adres sorgularında adres parçaları sunucu loglarına düşebilir.
- **Düzeltme:** Yalnız `error.message`/`error.code` logla; tam obje/girdi loglama.

### B10. [DÜŞÜK] `order.id` tüm partner yüzeylerinde + mail preview'da açık
- **Konum:** `fason-status.tsx:23,27`, `fason-cancelled.tsx:18,22`; `[id]/page.tsx:221`
- **Düzeltme:** Partner kanalında assignment-scoped opak referans değerlendir; veri minimizasyonu.

### B11. [DÜŞÜK] Partner revize uçları (`save-edit`/`design-url` bypass) bu denetimde okunmadı
- **Konum:** `partner/siparisler/[id]/duzenle/[itemId]/page.tsx:130-179, 192-204`
- **Düzeltme:** `design-url`/`save-edit` partner-bypass dallarının order objesini geniş select'le çekip PII döndürmediğini ayrıca denetle.

---

# C) ATAMA DURUM MAKİNESİ & AUDIT

> **FSM (çıkarılan, `apply-assignment-action.ts:34-40`):**
> `acknowledge`: {assigned,sent}→acknowledged · `in_production`: {acknowledged}→in_production ·
> `ready`: {in_production}→ready · `shipped`: {ready}→shipped ·
> `issue`: {assigned,sent,acknowledged,in_production,ready}→issue.
> Terminal (cancelled, shipped) geri dönüşü FSM'de engelli — ama `issue`'dan çıkış yok (C3).

### C1. [KRİTİK] Pause/terminate edilen partner aktif siparişi üretmeye devam edebiliyor
- **Konum:** `partner/orders/[id]/status/route.ts:80-89` + `assert-active-partner-assignment.ts:29-37`
- **Sorun:** Status güncellemesi yalnız **assignment** durumunu kontrol eder; `fason_partners.status`/`active`'e bakmaz. Admin partneri `paused`/`terminated` yapsa bile aktif atamalar `cancelled`'a çekilmediğinden partner `acknowledge→...→shipped` ile siparişi tamamlar. Pause sadece token revoke ediyor; partner SESSION ile çalışıyor.
- **Düzeltme:** `status/route.ts`'te atamadan sonra `fason_partners.status='active' AND active=true` kontrolü ekle, değilse 403. İdealde pause/terminate aktif atamaları da askıya alsın.

### C2. [KRİTİK] pause/terminate/resume audit_log yazmıyor
- **Konum:** `pause/route.ts:31-54`, `terminate/route.ts:28-51`, `resume/route.ts:20-36`
- **Sorun:** Hassas yönetimsel mutasyonlar hiç `logServerAudit` çağırmıyor; sadece `updated_by` yazılıyor (eski-değer/sebep/zaman yok). Terminate gibi kalıcı aksiyon izsiz.
- **Düzeltme:** Üçüne de `logServerAudit` (eski→yeni status, reason, actor) ekle; `AuditAction`'a `partner.pause/terminate/resume` ekle.

### C3. [KRİTİK] "issue" durumu kalıcı ölü-kilit; FSM çıkışı yok
- **Konum:** `apply-assignment-action.ts:34-40`
- **Sorun:** Hiçbir aksiyonun `ALLOWED_FROM`'u `issue`'yu içermiyor. Atama `issue`'ya geçince partner artık ilerletemez; sorun çözülse bile. `issue` aktif statü olduğundan (`active-assignment-statuses.ts:8`) kapasiteyi işgal eder. Tek çıkış admin revoke.
- **Düzeltme:** `issue`'dan dönüş aksiyonu (örn. admin `resume_production`: issue→acknowledged/in_production) tanımla veya issue'yu non-blocking flag yap.

### C4. [YÜKSEK] `applyAssignmentAction` read-then-write yarışı (TOCTOU); transaction yok
- **Konum:** `apply-assignment-action.ts:217-245`
- **Sorun:** Status `select` (217) → FSM JS kontrolü (228) → ayrı `update` (237), koşulsuz. İki eşzamanlı istek aynı `currentStatus`'u okuyup ikisi de update edebilir → çift `order_events`.
- **Düzeltme:** Koşullu update: `.eq("id",assignmentId).in("status",allowedFrom)`; dönen satır 0 ise 409 (optimistic concurrency).

### C5. [YÜKSEK] Kapasite guard'ı TOCTOU; eşzamanlı atama limiti aşabilir
- **Konum:** `assign-guards.ts:60-78` + `assign/route.ts:87-93`
- **Sorun:** Kapasite `count` RPC'den ÖNCE ayrı sorguda; iki eşzamanlı atama (farklı sipariş, aynı partner) ikisi de `max-1` okuyup geçebilir. Partial unique index (Mig 169) yalnız aynı order çift atamasını engeller, kapasiteyi değil.
- **Düzeltme:** Kapasite kontrolünü `fn_assign_order_to_fason` RPC içine (transaction + row lock) taşı.

### C6. [YÜKSEK] pause/terminate/resume sessiz no-op + durum geçiş kontrolü yok
- **Konum:** `pause/route.ts:32-46`, `resume/route.ts:21-29`, `terminate/route.ts:29-43`
- **Sorun:** `update().eq("id",id)` hiçbir satır eşleşmese de error vermez → geçersiz ID'de `{ok:true}`. Ayrıca `terminated` partner tekrar `paused` veya `resume` ile geri açılabiliyor (terminate "kalıcı" sözü ihlal).
- **Düzeltme:** `.select()` ile dönen satırı doğrula (0→404); `resume`'da `status='terminated'` ise reddet; geçişleri whitelist'le.

### C7. [YÜKSEK] Revoke read-then-write yarışı; çift revoke / status update yarışı
- **Konum:** `revoke-assignment.ts:41-134`
- **Sorun:** `select` (41) → JS kontrol (58) → koşulsuz `update cancelled` (122). Revoke + partner status-update yarışında partner update kaybolur/tutarsız; iki revoke → çift `fason_cancelled` event + çift cancel maili.
- **Düzeltme:** Koşullu update `.eq("id").in("status",[...REVOKABLE])`, 0 satır → 409; tercihen tüm akışı RPC/transaction'a al.

### C8. [YÜKSEK] `applyAssignmentAction` içindeki order_events/orders-update best-effort; sessiz yutuluyor
- **Konum:** `apply-assignment-action.ts:247-291`
- **Sorun:** Assignment update sonrası `fason_link_access_log`, `logOrderEvent`, `shipped`'te `orders.status='shipped'` (278-282) — error kontrolü yok. Order update hatası yutulursa atama `shipped` ama sipariş `ready` kalır (tutarsızlık).
- **Düzeltme:** Assignment + order status + event tek RPC/transaction'da; en azından `orders.update` hatasını logla/telafi et.

### C9. [ORTA] Partner status değişiklikleri (shipped dahil) merkezi audit_log'a yazılmıyor
- **Konum:** `apply-assignment-action.ts:257-276`
- **Sorun:** Partner üretim güncellemeleri yalnız `order_events`/`fason_link_access_log`'a gidiyor; `audit_log`'a değil → admin denetim asimetrik (admin assign/revoke audit'te, partner shipped değil).
- **Düzeltme:** En azından `shipped` ve `issue` için `logServerAudit` ekle.

### C10. [ORTA] file-transfers (baskı dosyası gönderimi) audit_log yazmıyor
- **Konum:** `file-transfers/route.ts:142-154`
- **Sorun:** Partnere imzalı baskı dosyası URL gönderimi (KVKK: müşteri tasarımının 3. tarafa aktarımı) yalnız `fason_file_transfers`'e, merkezi audit'e değil.
- **Düzeltme:** POST sonunda `logServerAudit` (action: `partner.file_transfer`, targetId: orderId) ekle.

### C11. [ORTA] `score.ts` ↔ SQL RPC paralel implementasyon drift'i; revoke skoru cezalandırmıyor
- **Konum:** `score.ts` + `refresh-fason-scores/route.ts:34-36` + Mig 021/025
- **Sorun:** TS saf fonksiyon, gerçek `cached_score`'u DB RPC yazıyor — drift riski. `return_rate` paydası yalnız `shipped`; `cancelled` (revoke) atamalar skora girmiyor → sürekli revoke edilen partner cezalanmıyor. Az veride default'larla şişmiş ~0.85.
- **Düzeltme:** `cancelled_count`'u formüle dahil et; TS↔SQL drift için snapshot test ekle.

### C12. [ORTA] Response süresi `sent→in_production`'dan ölçülüyor; mail kuyruğu partneri haksız yavaş gösterir
- **Konum:** `status/route.ts:91-125` + Mig 021:55-59
- **Düzeltme:** Ölçümü `acknowledged_at→in_production_at`'e veya tutarlı referansa sabitle.

### C13. [ORTA] Revoke'ta order status geri alma event taramasıyla yapılıyor — kırılgan
- **Konum:** `revoke-assignment.ts:95-118`
- **Sorun:** Son 20 `fason_assigned` event taranıp `status_after` bulunuyor; event silinmiş/eski ise `revertStatus` boş → yanlış order status'a dönebilir.
- **Düzeltme:** Atama satırına `order_status_before` snapshot kolonu ekle; revoke onu kullansın.

### C14. [DÜŞÜK] `urgentReasonLabel` parametresini yok sayıyor (her zaman sabit etiket)
- **Konum:** `urgent-assignment.ts:22-24` → switch ile reason'ı kullan veya parametreyi kaldır.

### C15. [DÜŞÜK] Admin bildirim maili her aksiyonda ek select + best-effort fallback
- **Konum:** `apply-assignment-action.ts:293-337` → partner adını ilk update öncesi tek seferde al.

---

## ❓ Doğrulanacaklar (kod dışı / teyit gerektirir)

1. **Supabase OTP konfigürasyonu:** otp-verify yorumundaki "5 hatada lock / 60sn TTL" iddiaları proje ayarına bağlı, kodda garanti yok — Supabase dashboard'da doğrula (A1'in ciddiyeti buna bağlı).
2. **`order_assignments`/`order_items` RLS:** Service-role bypass ediyor; partner kendi JWT'siyle doğrudan PostgREST'e giderse cross-tenant okuyabilir mi? RLS politikalarını doğrula.
3. **`fn_assign_order_to_fason`'un paused/terminated reddi:** RPC gerçekten `active=false` partneri reddediyor mu (Mig 024/169 gövdesi)?
4. **`meta`/`config` canlı veride PII taşıyor mu:** Kişiselleştirilmiş ürünlerde (isimli sticker/davetiye) yüksek olasılık — örnek siparişlerle teyit et.
5. **`city` serbest metin mi:** Checkout form validasyonu `city`'ye tam adres girilmesine izin veriyor mu? (B7)
6. **`design-url`/`save-edit` partner-bypass yanıtları:** Order objesini geniş select'le çekip PII döndürüyor mu? (B11)
7. **`logOrderEvent` idempotency:** C4/C7'deki çift-event riski bu fonksiyonun davranışına bağlı.
8. **Cron çift çalışması:** `fason-deadline-reminder`'da `fn_generate_fason_token` iki paralel çalışmada çift token üretip eskiyi geçersizler mi?

---

## Genel değerlendirme

**Sağlam çıkanlar:** order/item IDOR koruması, token mimarisi (entropi/hash/expiry/revoke), adres redaksiyon fonksiyonunun kendisi, mail şablonları, admin-guard'lı baskı URL'leri, status FSM'nin temel kısıtları.

**Gerçek sorunlar (senin sezginin doğrulandığı yer):**
1. **KVKK/veri sızıntısı en ciddi alan** — redaksiyon fonksiyonu iyi ama komşu alanlar (`meta`, `notes`, `config`, dosya adı) ham, üstelik **auth'suz public token ucundan**. (B1-B3, B6)
2. **Operasyonel kontrol zayıf** — pause/terminate gerçek koruma ve audit sağlamıyor; partner durdurulduktan sonra bile üretim yapabiliyor. (C1, C2, C6)
3. **Durum makinesi delikleri** — issue ölü-kilidi (C3) + yaygın TOCTOU yarışları (C4/C5/C7/C8).
4. **OTP girişi** — auth zincirinin en zayıf halkası (A1-A4).
