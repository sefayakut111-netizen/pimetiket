# 📧 Resend Mail Kurulum Rehberi

> **Sefa için 5 adımlı kurulum** — sipariş onay, prova hazır, kargo, teslim mailleri için.
> **Süre:** 30 dakika · **Maliyet:** 0₺/ay (free tier 3.000 mail/ay)

---

## Şu anki durum

✅ **Kod tarafı hazır** — `src/lib/mail/resend.ts` + `mail_outbox` cron çalışıyor.
❌ **Env yok** — `RESEND_API_KEY` ve `RESEND_FROM_EMAIL` Vercel'de set değil.

**Sonuç:** Sipariş alınıyor, mail outbox'a yazılıyor, ama cron Resend olmadığı için sessizce skip ediyor. Müşteri **hiçbir mail almıyor.**

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
   TXT  send.pimetiket.com   v=spf1 include:amazonses.com ~all
   CNAME resend._domainkey.pimetiket.com   resend._domainkey.<region>.amazonses.com
   TXT  _dmarc.pimetiket.com   v=DMARC1; p=none;
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

### 4. Vercel'e env ekle (2 dk)
1. https://vercel.com → Pim Etiket projesi → **Settings** → **Environment Variables**
2. İki değişken ekle (her ikisi de **Production** scope):

   | Key | Value |
   |-----|-------|
   | `RESEND_API_KEY` | `re_xxxxxxxxxxxx` (3. adımdaki) |
   | `RESEND_FROM_EMAIL` | `Pim Etiket <info@pimetiket.com>` |

3. **Save**

### 5. Redeploy (1 dk)
1. Vercel → **Deployments** → en üstteki deployment → **⋯** menüsü → **Redeploy**
2. ~2 dk içinde build biter, mail aktif olur

---

## Test et

1. Tarayıcıda incognito modda https://pimetiket.com'a git
2. Bir test siparişi ver (PayTR test modunda küçük tutar)
3. Sipariş tamamlandıktan sonra **~1 dk içinde** sipariş onay maili gelmeli
4. Cron süresi: `vercel.json` → `process-mail-outbox` her 5 dakikada bir çalışır

### Manuel cron tetikle (test için)
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://pimetiket.com/api/cron/process-mail-outbox
```

---

## Mevcut Mail Şablonları (12 adet)

`src/lib/mail/templates/` altında — Resend aktifleşince hepsi çalışır:

| Şablon | Tetikleyici |
|--------|-------------|
| `order-confirmation` | Sipariş tamamlandığında |
| `order-upload-reminder` | 24 saat tasarım yüklemezse |
| `order-proof-required` | AI QC failed |
| `order-proof-reminder` | Prova bekliyor, 24sa hatırlatma |
| `order-proof-approved` | Müşteri provayı onayladı |
| `proof-ready` | Prova hazır, onay bekleniyor |
| `qc-flagged` | AI dosya bayrak attı |
| `qc-rejected` | İnsan operatör reddetti |
| `shipping-update` | Kargo durumu güncel |
| `shipment-status` | Tracking event geldi |
| `order-delivered` | Teslim edildi |
| `lead-welcome` | /sablonlar şablon kayıt |

---

## Sorun giderme

### "Mailler hâlâ gelmiyor"
1. Vercel → Functions tab → `/api/cron/process-mail-outbox` log
2. Hata: `RESEND_API_KEY eksik` → env doğru yazılmış mı kontrol
3. Hata: `Domain not verified` → 5 dk DNS bekle
4. **Spam klasörünü kontrol** — domain yeni eklendi, ilk haftalarda spam'e düşebilir

### "DMARC fail" warning
- Cloudflare → DMARC TXT kaydı `p=none` ile başla (test moduna eşit)
- 1 ay sonra `p=quarantine` → 3 ay sonra `p=reject` (kademeli)

---

**Tarih:** 21 Mayıs 2026 · **Versiyon:** v1.0
