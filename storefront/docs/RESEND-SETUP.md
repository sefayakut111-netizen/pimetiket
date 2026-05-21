# 📧 Resend Mail Kurulum Rehberi

> **Sefa için 7 adımlı kurulum** — sipariş onay, prova hazır, kargo, teslim mailleri + observability + KVKK uyumlu unsubscribe.
> **Süre:** ~45 dakika · **Maliyet:** 0₺/ay (free tier 3.000 mail/ay)

---

## Şu anki durum (21 May v68 — Resend tamamlama paketi sonrası)

### ✅ Kod tarafı tamamlandı

| Katman | Dosya | Durum |
|---|---|---|
| API client | `src/lib/mail/resend.ts` | ✅ |
| Template registry | `src/lib/mail/templates.ts` (13 şablon) | ✅ |
| Enqueue helper | `src/lib/mail/enqueue.ts` (idempotency + suppression) | ✅ |
| Outbox cron | `/api/cron/process-mail-outbox` (List-Unsubscribe header) | ✅ |
| Webhook | `/api/webhooks/resend` (Svix imza) | ✅ |
| Unsubscribe | `/api/mail/unsubscribe` + `/bildirim-tercihleri/cikis` | ✅ |
| Suppression list | `mail_suppressions` tablosu (Migration 076) | ✅ |
| Admin observability | `/admin/mail-health` dashboard | ✅ |

### ❌ Sefa tarafında yapılacaklar

1. Resend hesap aç + domain doğrula
2. API key + webhook secret oluştur
3. Vercel'e 4 env ekle
4. Migration 076'yı production'a uygula
5. Redeploy

---

## Adımlar

### 1. Resend hesap aç (5 dk)

1. https://resend.com → "Sign Up"
2. Email + şifre ya da GitHub ile giriş
3. Email doğrulama → tamam

### 2. Domain ekle ve DNS doğrula (10 dk)

1. Dashboard → **Domains** → **Add Domain**
2. `pimetiket.com` yaz → Add
3. Resend 3 DNS kaydı verir (SPF, DKIM, DMARC):
   ```
   TXT   send.pimetiket.com           v=spf1 include:amazonses.com ~all
   CNAME resend._domainkey.pimetiket.com   resend._domainkey.<region>.amazonses.com
   TXT   _dmarc.pimetiket.com         v=DMARC1; p=none; rua=mailto:dmarc@pimetiket.com
   ```
4. **Cloudflare DNS panelinde** bu 3 kaydı ekle (`pimetiket.com` zone)
5. Resend dashboard'da "Verify" butonuna bas → ~5 dk içinde yeşil ✓

> ⚠️ DNS propagation gecikebilir. Sabırlı ol, 1 saate kadar zaman tanı.

### 3. API key oluştur (1 dk)

1. Dashboard → **API Keys** → **Create API Key**
2. Name: `Pim Etiket Production`
3. Permission: **Full Access**
4. Domain: `pimetiket.com` seç
5. `re_xxxxxxxxxxxx` ile başlayan key'i kopyala — **bir daha gösterilmez, kaybetme**

### 4. Webhook endpoint ekle (3 dk) — YENİ

> Bu adım atılmazsa: bounce/complaint/delivered eventleri sisteme düşmez,
> `mail_suppressions` boş kalır, `/admin/mail-health` 0 gösterir.

1. Dashboard → **Webhooks** → **Add Endpoint**
2. **Endpoint URL:** `https://pimetiket.com/api/webhooks/resend`
3. **Events** (hepsini seç):
   - `email.sent`
   - `email.delivered`
   - `email.delivery_delayed`
   - `email.bounced`
   - `email.complained`
   - `email.opened`
   - `email.clicked`
   - `email.failed`
4. **Save** → Resend `whsec_xxxxxxxxxxxx` ile başlayan **signing secret** verir
5. Bu secret'ı kopyala — bir sonraki adımda env olarak ekleyeceksin

### 5. Unsubscribe secret üret (1 dk) — YENİ

> Token-li tek-tıkla unsubscribe linki + RFC 8058 List-Unsubscribe header için.

PowerShell'de:
```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Veya bash:
```bash
openssl rand -hex 32
```

Çıktıyı kopyala — sonraki adımda `UNSUBSCRIBE_SECRET` env'i olacak.

> ⚠️ Secret rotate edersen tüm mevcut unsubscribe linkleri invalidate olur.
> 1 yıl boyunca aynı kalsın.

### 6. Vercel'e env ekle (3 dk)

1. https://vercel.com → Pim Etiket projesi → **Settings** → **Environment Variables**
2. **Dört değişken** ekle (hepsi **Production** scope):

   | Key | Value | Adım |
   |-----|-------|------|
   | `RESEND_API_KEY` | `re_xxxxxxxxxxxx` | Adım 3 |
   | `RESEND_FROM_EMAIL` | `Pim Etiket <info@pimetiket.com>` | — |
   | `RESEND_WEBHOOK_SECRET` | `whsec_xxxxxxxxxxxx` | Adım 4 |
   | `UNSUBSCRIBE_SECRET` | `<64 char hex>` | Adım 5 |

3. **Save**

### 7. Migration 076 uygula (2 dk) — YENİ

> `mail_suppressions` tablosu + `fason_mail_outbox` observability kolonları
> + `fn_enqueue_mail` idempotency için.

Supabase Dashboard → **SQL Editor**:

```sql
-- supabase/migrations/076_mail_suppressions_and_observability.sql
-- içeriğini kopyala-yapıştır → Run
```

Veya CLI (linked project):
```bash
npx supabase db push --linked
```

Verify:
```sql
SELECT tablename FROM pg_tables WHERE tablename = 'mail_suppressions';
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fason_mail_outbox' AND column_name = 'idempotency_key';
```

İkisi de satır dönerse OK.

### 8. Redeploy (1 dk)

1. Vercel → **Deployments** → en üstteki deployment → **⋯** menüsü → **Redeploy**
2. ~2 dk içinde build biter, mail aktif olur

---

## Test et

### Mail gönderim testi
1. Tarayıcıda incognito modda https://pimetiket.com'a git
2. Bir test siparişi ver (PayTR test modunda küçük tutar)
3. Sipariş tamamlandıktan sonra **~1 dk içinde** sipariş onay maili gelmeli
4. Cron süresi: `vercel.json` → `process-mail-outbox` günde 1× çalışır (Hobby plan limiti)

### Manuel cron tetikle (test için)
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://pimetiket.com/api/cron/process-mail-outbox
```

### Webhook testi
1. Resend Dashboard → Webhooks → endpoint'in yanında **"Send test event"**
2. `/admin/mail-health` sayfasını aç → "Suppression listesi" boş ama
   "Mailbox'a düşen" kartı stat almalı (gerçek mail gönderdiysen)

### Unsubscribe testi
1. Lead/marketing mail aldığın bir test account'ta
2. Footer'daki "Tek tıkla çık" linkine bas
3. `/bildirim-tercihleri/cikis?t=...` sayfası açılmalı
4. "Evet, beni çıkar" → `mail_suppressions` tablosunda satır oluşmalı

---

## Müşteri Mail Akışı — Tetik Noktaları

> **Sefa 21 May v68 notu:** Müşteri mailleri eskiden direkt `sendMail()`
> çağırıyordu, outbox'tan geçmiyordu. Bu refactor sonrası **HEPSİ**
> outbox'tan geçer → suppression / idempotency / retry / webhook tracking /
> observability hepsi otomatik kazanılır. notifications.ts içindeki
> `enqueuePrerendered()` helper'ı render edilmiş HTML'i `_prerendered`
> template key'i ile outbox'a yazar.

### Sipariş yaşam döngüsü (Ayşe Hanım'ın yolculuğu)

> **Sefa 21 May v68 — Sadeleştirme:** Mail fatigue önlemek için 4 mail
> kapatıldı. Müşteri başına ortalama mail sayısı: 5 → 3 (mutlu yol).

| Aşama | Mail | Helper | Tetik noktası | Durum |
|-------|------|--------|---------------|-------|
| 1 | **Sipariş alındı** 🎉 | `sendOrderConfirmation` | `/api/payment/callback` success + paytr-reconciler | ✅ Aktif |
| 2 | **Baskı önizlemen hazır** | `sendOrderProofRequired` | aynı yer (paid → proof_pending) | ✅ Aktif |
| 3 | **Baskı onayını bekliyoruz** (24sa) | `sendOrderProofReminder` | `/api/cron/auto-refund` | ✅ Aktif |
| 4 | ~~Üretime geçtik~~ 🎉 | `sendOrderProofApproved` | (kapalı) | ❌ **Faz 2** — UI'da feedback |
| 5a | **Tasarım düzeltmesi gerekiyor** | `sendQcRejected` | `/api/admin/ai-qc/decide` | ✅ Aktif |
| 5b | ~~Tasarım inceleniyor~~ (AI flag) | `sendQcFlagged` | (kapalı) | ❌ **Faz 1** — 1-3sa sonuç |
| 6 | _Provan hazır (manuel)_ | `sendProofReady` | _bağlanmamış_ | ⚪ Hayalet |
| 7 | **Kargon yola çıktı** 🚚 | `sendShipmentStatus(in_transit)` | `/api/cron/poll-shipments` | ✅ Aktif |
| 8 | ~~Kargon bugün dağıtımda~~ 🛵 | `sendShipmentStatus(out_for_delivery)` | (kapalı) | ❌ **Faz 1** — Yurtıçi SMS |
| 9 | ~~Sipariş teslim edildi~~ ✅ | `sendOrderDelivered` | (kapalı) | ❌ **Faz 2** — Yurtıçi SMS |
| 10 | **Yorum yazar mısın?** ⭐ | `customer_review_request` (template) | `/api/cron/request-reviews` (teslim+7gün) | ✅ Aktif — teslim onayı + CTA tek mail |

**Aktif müşteri maili sayısı: 6** (1, 2, 3, 5a, 7, 10) + 5b/6 koşullu
**Faz 1+2 kazanç:** Mutlu yolda 5 → 3 mail (%40 azalma), Resend bütçesi rahat.

### Geri açmak istersen
- **Üretime geçtik (#4):** `src/app/api/orders/[id]/proof/finalize/route.ts` — yorum satırlarını aç
- **Dağıtımda (#8) + Teslim (#9):** `src/app/api/cron/poll-shipments/route.ts` — Faz 1/Faz 2 yorum bloklarını aç

### Sepet & lead akışı (marketing — opt-out edilebilir)

| Mail | Helper | Tetik |
|------|--------|-------|
| **Hoş geldin + şablon paketi** | `lead_welcome` template | `/api/lead/subscribe` |
| **Sepetin kapanmadı** (24sa) | `customer_abandoned_cart` template | `/api/cron/detect-abandoned-carts` |
| **Yorum yaz** | `customer_review_request` template | `/api/cron/request-reviews` |

### Operasyon mailleri (her zaman gönderilir)

| Mail | Helper | Tetik |
|------|--------|-------|
| **🛒 Yeni sipariş** (admin) | `admin_new_order` template | `/api/payment/callback` success |
| **📊 Günlük özet** (admin, 09:00) | `admin_daily_summary` template | `/api/cron/admin-daily-summary` |
| **Yeni iş** (fason) | `fason_new_assignment` template | DB trigger (Mig 020) |
| **72sa onaysız → iade** | `auto_refund_stale_proof` template | DB trigger (Mig 070) |

### Suppression davranışı (KVKK)

| Kategori | Bounce/complaint bloklar mı? | Unsubscribe bloklar mı? |
|----------|----------------------------|------------------------|
| `customer` (sipariş, kargo, fatura) | ✅ Hard bounce + complaint hep bloklar | ❌ KVKK m.5/2-c: hizmetin parçası |
| `admin` (Sefa'ya bildirim) | ✅ | ❌ Sefa kendisi env'i kaldırmalı |
| `fason` (partner iş atama) | ✅ | ❌ Sözleşme akışı |
| `lead` (marketing/blog) | ✅ | ✅ Token-li one-click unsubscribe |

---

## Observability — `/admin/mail-health`

Sefa için canlı dashboard. Görünür:

- **Resend bağlantı durumu** — API key + webhook secret + unsubscribe secret kontrol
- **24 saat istatistikleri** — enqueued, sent, delivered, bounce, complaint, open, click
- **Delivery rate / bounce rate / complaint rate**
- **Kategori bazlı kırılım** — fason/customer/lead/admin
- **Suppression listesi** — bounce/complaint/manual_admin, manuel ekle-kaldır
- **Failed mailler** — son 20, retry'ı bekleyen

URL: https://pimetiket.com/admin/mail-health

---

## Sağlıklı metrik aralıkları (sektör ortalaması)

| Metrik | İyi | Uyarı | Kritik |
|---|---|---|---|
| Delivery rate | %95+ | %85-95 | <%85 |
| Bounce rate | <%2 | %2-5 | >%5 |
| Complaint rate | <%0.1 | %0.1-0.3 | >%0.3 |
| Open rate (transactional) | %40+ | %20-40 | <%20 |
| Open rate (marketing) | %20+ | %10-20 | <%10 |

Complaint rate %0.3'ü geçerse Gmail/Yahoo gönderim itibarını düşürür.
Bu nedenle `/admin/mail-health` Hero kart'taki "Bounce + Complaint" rakamı
**her gün kontrol edilmeli.**

---

## Sorun giderme

### "Mailler hâlâ gelmiyor"
1. Vercel → Functions tab → `/api/cron/process-mail-outbox` log
2. Hata: `RESEND_API_KEY eksik` → env doğru yazılmış mı kontrol
3. Hata: `Domain not verified` → 5 dk DNS bekle
4. **Spam klasörünü kontrol** — domain yeni eklendi, ilk haftalarda spam'e düşebilir

### "Webhook 401 dönüyor (Resend dashboard'da)"
1. `RESEND_WEBHOOK_SECRET` env'ini Vercel'e ekledikten sonra **redeploy** ettin mi?
2. Resend dashboard'taki secret'ın **whsec_** ile başladığından emin ol
3. Resend webhook event'leri 24 saat retry yapar — secret düzeldikten sonra
   otomatik catch up

### "Unsubscribe linki çalışmıyor"
1. `UNSUBSCRIBE_SECRET` env set mi? `/admin/mail-health` → Unsubscribe pill
   yeşil mi?
2. Link 365 günden eski olabilir — yeni bir test maili gönder
3. Secret'ı değiştirdiysen tüm eski linkler invalidate olur (beklenen davranış)

### "DMARC fail" warning
- Cloudflare → DMARC TXT kaydı `p=none` ile başla (test moduna eşit)
- 1 ay sonra `p=quarantine` → 3 ay sonra `p=reject` (kademeli)

### "/admin/mail-health hata gösteriyor"
- `42703` → Migration 076 uygulanmamış (adım 7'yi çalıştır)
- `42P01` → `mail_suppressions` tablosu yok (yine adım 7)
- `403` → /auth'tan admin olarak giriş yap

---

## KVKK Notu

Pim Etiket mailleri **iki ana sınıfa** ayrılır:

### Transactional (KVKK m.5/2-c — hizmetin zorunlu parçası)
`customer`, `admin`, `fason` kategorileri:
- Sipariş onayı, prova hazır, kargo durumu, fatura, iade onayı vb.
- **Unsubscribe edilemez** — KVKK açık rıza gerektirmez
- Footer'da "tek tıkla çık" linki **basılmaz**

### Marketing/lead (KVKK m.5/1 — açık rıza)
`lead` kategorisi:
- Şablon paketi, kampanya, blog yazıları, sepet hatırlatma, yorum isteği
- **Footer'da zorunlu** tek-tıkla unsubscribe linki bulunur
- RFC 8058 List-Unsubscribe header gönderilir (Gmail/Yahoo "Unsubscribe" butonu)
- `mail_suppressions` tablosu KVKK silme talepleri için kullanılır

`/admin/mail-health` "Manuel suppression" formu, KVKK silme talebi gelen
müşterileri **tüm kategorilerde** bloklayan hard-suppression eklemenin yoludur.
Audit-log'a Sefa kullanıcı id'siyle düşer.

---

**Tarih:** 21 Mayıs 2026 · **Versiyon:** v2.0 (Resend tamamlama paketi)
