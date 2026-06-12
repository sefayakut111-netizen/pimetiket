# Cursor Notları — M12: Mail, Bildirim & Outbox

> Hata-tespit (P3). Boyut: D2 sözleşme, D3 hata, D4 idempotency, D6 güvenlik.
> **Genel:** Outbox/idempotency/webhook mimarisi olgun — `fn_enqueue_mail` suppression+idempotency atomik, cron atomik claim, webhook Svix imzası+timestamp doğru. **Sorun:** iki admin mail yolu tüm korumaları bypass ediyor + iki template registry'de eksik (mail hiç gitmiyor).

## 🔴 KRİTİK

### B1. `password_reset` ve `admin_custom` template'leri registry'de YOK → mail kalıcı fail · D2
- **Konum:** `lib/mail/templates.ts:923-946` (RENDERERS) ↔ `admin/customers/[id]/reset-password/route.ts:83`, `send-email/route.ts:81`
- **Sorun:** İki route outbox'a `template_key:"password_reset"`/`"admin_custom"` insert ediyor ama RENDERERS'ta yok → cron `renderMailTemplate` null → `unknown_template` + `next_retry_at=null` = kalıcı ölü. Admin "şifre sıfırla" ve "müşteriye mail" butonları sessizce hiç göndermiyor, UI 200 dönüyor. Özellikle password_reset → müşteri erişim sorunu.
- **Düzeltme:** `renderPasswordReset`/`renderAdminCustom` ekle ve RENDERERS'a kaydet; veya route'ları `_prerendered`/`enqueueMail()` üzerinden geçir.

### B2. Admin mail route'ları `fn_enqueue_mail`'i bypass → suppression+idempotency atlanıyor · D2/D4/D6
- **Konum:** `admin/customers/[id]/send-email/route.ts:78-94`, `reset-password/route.ts:80-96`
- **Sorun:** İkisi de doğrudan `insert("fason_mail_outbox")`. → (a) suppression hiç kontrol edilmiyor (bounce/complaint/unsubscribe adrese mail; KVKK/spam), (b) idempotency_key yok → çift buton = çift mail, (c) email format validasyonu atlanır. Diğer tüm yollar RPC'den geçiyor, yalnız bu ikisi istisna.
- **Düzeltme:** İkisini `enqueueMail({...})`'e çevir (suppression+idempotency+validasyon bedava); send-email için `admin_custom:${id}:${hash}` key.

## 🟠 YÜKSEK

### B3. Webhook outbox güncellemesi replay/sıra-dışı event'e korumasız (yorum yanıltıcı) · D4/D2
- **Konum:** `webhooks/resend/route.ts:266-275` (yorum "replay korumalı" ama null guard YOK)
- **Sorun:** `update(updates).eq("resend_message_id",messageId)` koşulsuz. Geç gelen `email.sent` daha önceki `delivered`/`bounced`'ı geri ezer (event'ler sırasız gelebilir); `opened_at` her açılışta güncellenir (yorum "ilk açılış" der). Suppression idempotent (kritik değil) ama durum tutarsızlığı/observability.
- **Düzeltme:** Durum-makinesi: yalnız null timestamp alanını set et (`.is("delivered_at",null)`); event önceliği (delivered/bounced > sent).

### B4. `isSuppressed()` TS helper'ı fail-open — enqueue dışı çağrılarda bypass · D3/D2
- **Konum:** `lib/mail/suppression.ts:86-93` (hata→`false`)
- **Sorun:** Gerçek karar RPC `fn_enqueue_mail` içinde (atomik, iyi) ama `isSuppressed()` TS helper'ı nerede kullanılırsa orada fail-open suppression bypass'ı.
- **Düzeltme:** enqueue dışı çağrıları doğrula; pazarlama mailinde fail-closed.

## 🟡 ORTA
- **B5.** `dayKey`/`today` UTC tabanlı (`notifications.ts:853,1466,1658`) — TR 00:00-03:00'te idempotency penceresi kayar → günde-bir garantisi bozulur/çift mail. → `Europe/Istanbul` timezone'lu gün anahtarı. · D4
- **B6.** STUB modunda `attempts` artmadan sonsuz "pending" → outbox süresiz büyür + starvation (en eskiler önce, yeni mail sıraya gelmez) (`cron/route.ts:221-237`). → stub TTL/expire. · D4/D3
- **B7.** `fason_new_assignment` token üretimi atomik claim'den ÖNCE (`cron/route.ts:147-201` vs `240-258`) → paralel cron çift token + claim'siz attempt tüketimi. → claim'i döngü başına al. · D4
- **B8.** `triggerMailProcess`+cron+manuel çoklu işleyici; stale-recovery (30dk `sending`→`failed`) gerçekten gönderilmiş ama `status:sent` update'i başarısız maili retry'lar → çift gönderim (`enqueue.ts:89`, `cron/route.ts:79-91,309`). → Resend `Idempotency-Key` header (outbox.id). · D4
- **B9.** Webhook çoklu-alıcıda yalnız `to[0]`; bounce yanlış adrese kaydedilebilir (`webhooks/resend:196-201`). → messageId'den gerçek `to_email` çek. · D2/D3
- **B10.** Soft bounce hiç işlenmiyor; `bounce_soft_repeated` tipi tanımlı ama hiç yazılmıyor (`webhooks/resend:235-236`) → tekrarlayan soft-bounce'a süresiz mail, reputation düşer. → sayaç ≥3 → suppression. · D3
- **B11.** `email.failed` outbox `status`'ünü `failed` yapmıyor, yalnız `last_error` (`webhooks/resend:251-254`) → "gönderildi" sanılır. → `status:"failed"` + `next_retry_at:null`. · D3

## 🟢 DÜŞÜK
- **B12.** Migration 076 "APPLY ONAYI BEKLİYOR" notu — `mail_suppressions`+`fn_enqueue_mail` revizyonu prod'da aktif mi doğrula; değilse B2 koruması zaten yok (`076:335-341`). · DOĞRULA
- **B13.** `UNSUBSCRIBE_SECRET ?? CRON_SECRET` fallback (`unsubscribe.ts:37`) — CRON_SECRET sızarsa zorla unsubscribe DoS. → ayrı secret zorunlu. · D6
- **B14.** Unsubscribe GET token'ı redirect query'de (referer/log sızıntısı), 365 gün geçerli (`unsubscribe/route.ts:129-130`). → TTL düşür. · D6

## [KOZMETİK]
- `webhooks/resend:267` yorumu gerçeği yansıtmıyor (B3 kökü).
- `cron/route.ts:44` `OutboxRow.assignment_id` non-nullable tiplenmiş ama Mig 035 sonrası nullable.
- `enqueue.ts:81` `suppressed` ile `idempotent-existing` ayırt edilemiyor (log kaybı).
- `generate-daily-summary.ts:54,57` emoji (`⚠`) — AGENTS.md emoji yasağı.

## ❓ Doğrulanacaklar
1. `fn_enqueue_mail` canlı argüman sayısı + `mail_suppressions` tablosu var mı (Mig 076 apply) — B12.
2. `isSuppressed()` enqueue dışı çağrılıyor mu (B4).

**En kritik:** B1 (password_reset/admin_custom mail hiç gitmiyor) · B2 (admin route suppression+idempotency bypass) · B3 (webhook durum ezme) · B12 (076 apply doğrulaması — uygulanmadıysa B2 koruması zaten yok). Çift-gönderim ana hattı sağlam; gerçek risk B8 stale-recovery + B2 bypass.
