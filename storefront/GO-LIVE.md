# 🚀 Pim Etiket — GO-LIVE Checklist

Bugün yapılacaklar. Tahmini **2-3 saat** (DNS yayılma hariç).

**Domain**: `pimetiket.com` (GoDaddy) · **Hosting**: Vercel · **DB**: Supabase

> PayTR onay aşamasında. Site canlıya çıkacak ama ödeme akışı **"Henüz aktif değil — WhatsApp'tan yaz"** mesajı gösterecek (mock akış güvenlik için kapalı). PayTR onayı gelince env ekleyip yeniden deploy → ödeme açılır.

---

## ⚙️ Adım 1 — Production Supabase (15 dk)

### 1.1 Yeni proje aç

1. https://supabase.com/dashboard → **New Project**
2. Name: `pimetiket-prod` · Region: `Frankfurt (eu-central-1)` · Plan: Free (yeter)
3. Database password: güçlü şifre, password manager'a kaydet

### 1.2 Migration push (9 SQL dosyası)

Dashboard → **SQL Editor → New query**. Sırayla yapıştır + Run:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_invoice_events_payments.sql
supabase/migrations/003_returns_design_files.sql
supabase/migrations/004_notifications_audit.sql
supabase/migrations/005_coupons_reviews.sql
supabase/migrations/006_storage_buckets.sql
supabase/migrations/007_payment_intents.sql
supabase/migrations/008_design_temp_uploads.sql
supabase/migrations/009_paytr_provider.sql
```

Her biri "Success. No rows returned" göstermeli.

### 1.3 Storage bucket'ları (Dashboard → Storage)

3 bucket aç:

| Bucket | Public | Limit | MIME |
|--------|--------|-------|------|
| `designs` | OFF | 30 MB | `application/pdf, image/png, image/jpeg, image/svg+xml, application/postscript, application/illustrator, image/vnd.adobe.photoshop` |
| `return-photos` | OFF | 10 MB | `image/png, image/jpeg, image/webp` |
| `public-assets` | ON | 5 MB | `image/png, image/jpeg, image/webp, image/svg+xml` |

### 1.4 Auth URL Configuration

`Authentication → URL Configuration`:

```
Site URL:        https://pimetiket.com
Redirect URLs:   https://pimetiket.com/auth/callback
                 https://www.pimetiket.com/auth/callback
```

### 1.5 3 Key kopyala (password manager'a)

`Project Settings → API`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← server-only, ASLA NEXT_PUBLIC_ ile başlatma
```

---

## 📧 Adım 2 — Resend domain (30 dk + DNS)

### 2.1 https://resend.com → API Keys → Create

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Pim Etiket <info@pimetiket.com>
```

### 2.2 Domain ekle

`Domains → Add Domain` → `pimetiket.com`. Resend 4 DNS kaydı verir.

### 2.3 GoDaddy DNS — Resend kayıtları

GoDaddy dashboard → `pimetiket.com` → DNS → Add Record. **4 kayıt**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `resend._domainkey` | `<Resend'in verdiği>` | 600 |
| TXT | `@` (SPF) | `v=spf1 include:resend.com ~all` | 600 |
| MX | `bounces` | `feedback-smtp.resend.com` (priority 10) | 600 |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@pimetiket.com` | 600 |

⚠️ Yayılma 15-30 dk. Resend dashboard "Verify" yeşil olunca tamamdır.

---

## 🌐 Adım 3 — Vercel deploy (20 dk)

### 3.1 Hesap + GitHub

1. https://vercel.com → GitHub ile giriş (Sefa hesabı)
2. **Add New Project** → repo: `pimetiket` (veya senin repo adın)
3. **Root Directory**: `storefront/` ⚠️ kritik, repo root değil
4. **Framework**: Next.js (otomatik)
5. **Build/Output**: default (npm run build, .next)

### 3.2 Environment Variables (Production scope)

Vercel → Settings → Environment Variables. Hepsi "Production":

```env
NEXT_PUBLIC_SITE_URL=https://pimetiket.com
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-key>
OPENAI_API_KEY=sk-proj-...

RESEND_API_KEY=re_prod_...
RESEND_FROM_EMAIL=Pim Etiket <info@pimetiket.com>

# (PayTR — onay gelince ekle, şimdilik boş bırak)
# PAYTR_MERCHANT_ID=
# PAYTR_MERCHANT_KEY=
# PAYTR_MERCHANT_SALT=
# PAYTR_TEST_MODE=0

# (Opsiyonel — sonra)
# NEXT_PUBLIC_GA4_MEASUREMENT_ID=
# NEXT_PUBLIC_POSTHOG_KEY=
# NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
# NETGSM_USERCODE=
# NETGSM_PASSWORD=
# NETGSM_HEADER=PIMETIKET
```

### 3.3 Deploy

**Deploy** butonu → ~3 dk. Default URL: `pimetiket-xxx.vercel.app`. Aç + smoke test.

---

## 🔗 Adım 4 — Domain bağla (10 dk + DNS)

### 4.1 Vercel'e domain ekle

Vercel → Settings → **Domains** → **Add** → `pimetiket.com` + `www.pimetiket.com`.

Vercel iki DNS kaydı ister:
- `pimetiket.com` (apex) → **A** record `76.76.21.21`
- `www.pimetiket.com` → **CNAME** `cname.vercel-dns.com`

### 4.2 GoDaddy'de DNS aç

⚠️ Mevcut **Parking** A kaydını sil.

`https://dcc.godaddy.com → My Products → pimetiket.com → DNS`:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

**Domain Forwarding KAPALI** (varsa kapat — Vercel SSL'i bozar).
**DNSSEC KAPALI** (default zaten kapalı).

### 4.3 Yayılmayı bekle (5-30 dk)

```bash
nslookup pimetiket.com
# Beklenen: 76.76.21.21
```

Vercel Dashboard'da `pimetiket.com` yanında ✓ yeşil + SSL aktif olunca tamam.

---

## ✅ Adım 5 — Smoke test (15 dk)

### 5.1 https://pimetiket.com — temel kontrol

- [ ] Sayfa açılıyor, HTTPS yeşil padlock
- [ ] Logo + Pim mascot görünüyor
- [ ] Çerez bannerı 1 saniyede çıkıyor → "Sadece zorunlu" tıkla
- [ ] `/sticker` aç → konfigüre et (kraft + parlak + 250 adet)

### 5.2 Auth akışı

- [ ] `/auth` → e-posta gir → mail kontrol (Spam'a düşmediğine bak)
- [ ] Mail içindeki link tıkla → `/panelim`'e dönmeli
- [ ] TopBar'da kullanıcı dropdown görünmeli

### 5.3 Cart + ödeme akışı

- [ ] `/sticker` → "Sepete ekle" → `/sepet` → ürün görünmeli
- [ ] `/odeme` → adres formu → "Güvenli ödemeye geç"
- [ ] **PayTR yokken bekleniyor**: `/odeme-sonuc?status=fail&reason=psp_unavailable`
  → "Ödeme henüz aktif değil — WhatsApp'tan yaz" sayfası görünmeli ✓

### 5.4 SEO

- [ ] `https://pimetiket.com/sitemap.xml` açılıyor
- [ ] `https://pimetiket.com/robots.txt` açılıyor
- [ ] Search Console'a domain ekle → sitemap submit

---

## 🎯 Adım 6 — PayTR onayı geldiğinde (gelecekte)

1. Mağaza paneli → 3 key kopyala → Vercel env'lere ekle:
   ```
   PAYTR_MERCHANT_ID=...
   PAYTR_MERCHANT_KEY=...
   PAYTR_MERCHANT_SALT=...
   PAYTR_TEST_MODE=0   ← canlı tahsilat
   ```
2. PayTR mağaza paneli → **Bildirim URL** ekle:
   ```
   https://pimetiket.com/api/payment/callback
   ```
3. Vercel → **Redeploy** (env değişiklikleri için)
4. Smoke test: `/odeme` → ödeme → PayTR iframe → test kart `4355 0843 5508 4358`

---

## 🆘 Yardım gerekirse

- Vercel deploy fail → DEPLOY.md "Sık karşılaşılan hatalar"
- Auth çalışmıyor → Site URL hâlâ localhost mu? Adım 1.4'e bak
- Mail Spam'a düşüyor → DKIM/SPF DNS henüz yayılmadı, 1-2 saat bekle

---

## 📋 İlk 24 saat checklist

```
[ ] https://pimetiket.com canlı, HTTPS ✓
[ ] Çerez bannerı + KVKK uyumu çalışıyor
[ ] Auth: magic link mail geliyor
[ ] Sticker config + sepet + /odeme akışı (psp_unavailable mesajı OK)
[ ] /tasarımlarım empty state
[ ] /panelim hoş geldin
[ ] Mobile (telefon): hamburger menu, layout uyumlu
[ ] Search Console: sitemap submit
[ ] (PayTR gelince) Ödeme akışı test
```

Hepsi yeşilse Pim Etiket **canlıdadır** 🎉
