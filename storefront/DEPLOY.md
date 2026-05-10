# Pim Etiket — Production Deploy Kılavuzu

`SETUP.md` lokal kurulum içindi. Bu doküman **canlıya alma** için.

**Önkoşul**: `SETUP.md` adımları lokal'de tamamlanmış olmalı (`npm run check` yeşil). Henüz değilse önce onu bitir.

**Süre**: ~2 saat (DNS propagation hariç).

---

## 🎯 Plan

```
1. Production Supabase projesi (dev'den ayrı)         15 dk
2. Production PayTR ayarları (test_mode=0)             10 dk + IP whitelist
3. Resend domain DKIM doğrulama                       30 dk + DNS yayılma
4. Hosting platformu seçimi + deploy                  20 dk
5. Domain DNS bağlama                                 10 dk + propagation
6. Auth redirect URL'leri update                       5 dk
7. Production smoke test                              15 dk
```

---

## 1. Production Supabase Projesi

**KRİTİK**: dev ve prod ayrı projeler olmalı. Test verisi prod'a sızmasın.

### 1.1 Yeni proje aç

1. https://supabase.com/dashboard → **New Project**
2. **Project Name**: `pimetiket-prod` (dev'den farklı isim)
3. **Region**: Frankfurt (eu-central-1) — KVKK uyumu
4. **Plan**:
   - Free: ilk 6 ay yeter (500MB DB, 1GB Storage, 50K MAU)
   - Pro ($25/ay): backup + 8GB + 100GB Storage — production önerilir

### 1.2 Migration push

`SETUP.md §1.3` aynı, ama dosyalar **8 migration** (mig 008 dahil):

```bash
# .env.local'e prod URL + anahtarları geçici eklemen gerek
npm run migrate     # script Dashboard URL'i verir
```

Veya Dashboard SQL Editor'de sırayla 001 → 008.

### 1.3 Storage bucket'ları

`SETUP.md §1.4`'teki 3 bucket: `designs`, `return-photos`, `public-assets`.

### 1.4 Auth ayarları (PROD URL'leri ile)

`Authentication → URL Configuration`:

| Alan | Değer |
|------|-------|
| Site URL | `https://pimetiket.com` (veya senin domain'in) |
| Redirect URLs | `https://pimetiket.com/auth/callback` |

⚠️ Site URL'de localhost **olmamalı** — prod kullanıcı magic link'leri yanlış adrese yönlendirir.

### 1.5 Production env değerlerini sakla

Vercel/Cloudflare dashboard'a girilecek. Şimdilik bir password manager'a kaydet:

```
NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (prod)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (prod, ASLA client'a sızdırma)
```

---

## 2. Production PayTR Ayarları

PayTR mağaza paneli zaten açıkmış olmalı (SETUP.md §2). Burada production'a geçiş ayarları.

### 2.1 Test mode kapat

`PAYTR_TEST_MODE=0` set et. **Önemli**: 1 olarak unutursan canlı tahsilat olmaz.

### 2.2 Bildirim URL'i — production

Mağaza paneli → **API & Çoklu Mağaza** → **Bildirim URL**:

```
https://pimetiket.com/api/payment/callback
```

⚠️ HTTPS zorunlu, HTTP olmaz. PayTR `merchant_oid + status + total_amount + hash` POST atar; bizim sunucu **MUTLAKA "OK" string** dönmelidir, yoksa retry yapar.

### 2.3 IP whitelist (önerilen)

PayTR → API & Çoklu Mağaza → **Onaylı IP'ler** alanına Vercel IP'lerini ekle. Vercel: tüm trafik için 76.76.21.0/24 vs vardır; alternatif "boş bırak" — herkesten kabul eder.

### 2.4 Production env

```env
PAYTR_MERCHANT_ID=<sayısal id>
PAYTR_MERCHANT_KEY=<32 char>
PAYTR_MERCHANT_SALT=<16 char>
PAYTR_TEST_MODE=0       # canlı tahsilat
```

⚠️ **MERCHANT_KEY + SALT prodüksiyon = sandbox aynı**. Sadece TEST_MODE değişir.

---

## 3. Resend Domain Doğrulama

### 3.1 Domain ekle

1. https://resend.com/domains → **Add Domain**
2. `pimetiket.com` ekle
3. Resend 4 DNS kaydı verir (DKIM CNAME, SPF TXT, MX, DMARC)

### 3.2 DNS kayıtları

Cloudflare DNS'in varsa (önerilen):

| Type | Name | Value |
|------|------|-------|
| CNAME | `resend._domainkey` | `<Resend'in verdiği>.dkim.resend.com` |
| TXT | `@` (SPF) | `v=spf1 include:resend.com ~all` |
| MX | `bounces` | `feedback-smtp.resend.com` (priority 10) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@pimetiket.com` |

**Cloudflare'de "Proxy" KAPALI olsun** (gri bulut) — proxy DKIM'i bozar.

### 3.3 Doğrulama

DNS yayılması 15-30 dk. Sonra Resend dashboard "Verify" tıkla → yeşil ✓.

```env
RESEND_API_KEY=re_prod_...
RESEND_FROM_EMAIL=Pim Etiket <info@pimetiket.com>
```

---

## 4. Hosting Platform Deploy

### Yöntem A: Vercel (önerilen)

#### 4.1 Hesap + GitHub bağla

1. https://vercel.com → GitHub ile giriş
2. **Import Project** → repo seç (`pimetiket`)
3. **Root Directory**: `storefront/` (önemli — repo root değil!)
4. **Framework Preset**: Next.js (otomatik algılar)
5. **Build Command**: `npm run build` (default OK)
6. **Output Directory**: `.next` (default OK)

#### 4.2 Environment variables

Vercel → Project → Settings → Environment Variables. Production scope'una ekle:

```
NEXT_PUBLIC_SITE_URL=https://pimetiket.com
NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=sk-proj-...
PAYTR_MERCHANT_ID=...
PAYTR_MERCHANT_KEY=...
PAYTR_MERCHANT_SALT=...
PAYTR_TEST_MODE=0
RESEND_API_KEY=re_prod_...
RESEND_FROM_EMAIL=Pim Etiket <info@pimetiket.com>
NETGSM_USERCODE=...
NETGSM_PASSWORD=...
NETGSM_HEADER=PIMETIKET
```

⚠️ **`SUPABASE_SERVICE_ROLE_KEY` mutlaka "Encrypted"** olmalı (Vercel default).

#### 4.3 Deploy

1. **Deploy** butonu → ilk deploy ~3 dk
2. Default URL alırsın: `pimetiket-xxx.vercel.app`
3. Aç, smoke test et (auth, sticker, sepet, ödeme)

### Yöntem B: Cloudflare Pages

PayTR'ye geçtiğimiz için artık mümkün — PayTR REST API çağrıları Edge runtime ile uyumlu (sadece `crypto.createHmac` kullanıyoruz). Yine de Supabase SSR + middleware Edge runtime'da edge-case'lere düşebilir.

Cloudflare Pages istersen:

1. `@cloudflare/next-on-pages` adapter kur
2. Tüm route'larda `runtime: "edge"` set et (mevcut middleware Edge uyumlu)
3. Deploy: `npx wrangler pages deploy .vercel/output/static`

**Cloudflare Pages alternatifi**: Vercel free tier'ı zorlanırsa migration mümkün. Şu an Vercel canlıda, post-launch karar verilecek.

---

## 5. Domain DNS Bağlama

### 5.1 Vercel'de domain ekle

Vercel → Project → Settings → **Domains** → `pimetiket.com` ekle.

Vercel bir CNAME veya A record verir:
- **Apex** (`pimetiket.com`): `A 76.76.21.21`
- **www** (`www.pimetiket.com`): `CNAME cname.vercel-dns.com`

### 5.2 DNS provider'da kayıt aç

#### Cloudflare DNS ise:

1. Cloudflare dashboard → `pimetiket.com` → DNS
2. Type **A**, Name `@`, IPv4 `76.76.21.21`, **Proxy: KAPALI** (gri bulut)
3. Type **CNAME**, Name `www`, Target `cname.vercel-dns.com`, **Proxy: KAPALI**

⚠️ Vercel zaten SSL veriyor; Cloudflare proxy AÇIK olursa "redirect loop" olur.

#### GoDaddy ise (pimetiket.com için):

1. https://dcc.godaddy.com → **My Products** → `pimetiket.com` → **DNS**
2. Mevcut **"Parking"** A kaydı varsa **sil** (`@` → `Parked` IP'si)
3. Mevcut CNAME `www` varsa **sil** veya düzenle
4. Yeni kayıtlar:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `76.76.21.21` | 600 (10 dk) |
| CNAME | `www` | `cname.vercel-dns.com.` (sondaki nokta önemli) | 600 |

5. **Save**. Yayılma 5-30 dk (TTL=600 ise hızlı).
6. GoDaddy bazen "Forwarding" feature'ı pushluyor — kapalı tut. Yoksa
   `pimetiket.com → www.pimetiket.com` redirect'i Vercel SSL'i bozar.
7. **DNSSEC**: GoDaddy default'ta kapalı. Açıksan kapat (Vercel ile uyumsuzluk).

#### Namecheap / başka:

DNS yönetiminden aynı A + CNAME kayıtlarını gir.

### 5.3 Doğrulama

DNS propagation 5-30 dk. Vercel Dashboard'da yeşil ✓ olunca tamamdır.

```bash
# Komut satırından test
nslookup pimetiket.com
# Beklenen: 76.76.21.21
```

---

## 6. Auth Redirect URL'leri Update

⚠️ **KRİTİK**: Domain bağlandıktan sonra Supabase'e geri dön:

`Authentication → URL Configuration`:

```
Site URL: https://pimetiket.com
Redirect URLs:
  https://pimetiket.com/auth/callback
  https://www.pimetiket.com/auth/callback
```

Eski `pimetiket-xxx.vercel.app` URL'lerini sil.

---

## 7. Production Smoke Test

### 7.1 Health check (uzaktan)

Lokalden production env ile:

```bash
# .env.local'e prod env'leri geçici koy
npm run check
```

Beklenen output:
```
✓ NEXT_PUBLIC_SITE_URL              https://pimetiket.com
✓ Supabase ping                     reachable
✓ Migration tables                  16/16 tablo bulundu
○ PAYTR_MERCHANT_ID                 set
✓ Resend API                        reachable + auth ok
```

### 7.2 Manuel test (gerçek müşteri akışı)

1. **Login**: `https://pimetiket.com/auth` → e-posta gir → mail kontrol → tıkla
2. **Sticker konfigüre**: 50 adet, kraft + parlak, 75×75
3. **Tasarım yükle** (DesignDropZone): bir PDF/PNG
4. **Sepete ekle** → mockup'ta tasarımın görünmeli
5. **Ödemeye geç**: adres gir, fatura "Fatura istemiyorum" seç (ya da gerçek TC)
6. **PayTR iframe**: ⚠️ **gerçek kart kullanma**, test mode'daysan PayTR test kartı `4355 0843 5508 4358` (CVV 000, MM/YY 12/30, 3DS SMS 1234)
7. **Mail kutusu**: order confirmation maili gelmeli (5 dk içinde)
8. **`/siparis/<id>`**: order detail görünmeli, AI ön-kontrol "qc_passed" veya "qc_warned"

### 7.3 Production'da OLMAMASI gereken şeyler

```bash
# Bu dosyalar repo'da olmamalı (.gitignore'da):
.env.local
.env.production
node_modules/
.next/
dist/

# Bu sayfalar production'da OLMAMALI:
/admin (henüz auth korumalı değil — staff RBAC P1)
```

---

## 🔥 İlk hafta kontrol noktaları

### Gün 1
- [ ] Sentry kurulumu (error tracking) — `SENTRY_DSN`
- [ ] Google Analytics (GA4 measurement ID) — `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- [ ] UptimeRobot ping (5 dk)

### Hafta 1
- [ ] İlk gerçek müşteri siparişi (Sefa'nın yakını, 1-2 sticker)
- [ ] Mail teslim oranı %95+ (Resend dashboard)
- [ ] Backup strategy: Supabase Pro daily backup aç

### Ay 1
- [ ] Cloudflare WAF rate limiting (P1)
- [ ] e-Fatura entegrasyonu (Logo/Paraşüt)
- [ ] B2B `/teklif-iste` formu

---

## 🆘 Sık karşılaşılan deploy hataları

### "Auth redirect URL mismatch"
Supabase Site URL hâlâ localhost. §6'ya bak.

### "PayTR Hash hatası" / token alınamıyor
`PAYTR_MERCHANT_KEY` veya `SALT` yanlış (boşluk olabilir). Mağaza panelinden tekrar kopyala.

### Sipariş açılmıyor (PayTR ödeme başarılı ama /siparis/[id] yok)
PayTR mağaza panelinde **Bildirim URL** set edilmemiş (`https://pimetiket.com/api/payment/callback`). Set edip Vercel logs'tan POST geldiğini doğrula.

### "Resend 401: from address not verified"
DNS DKIM kayıtları yayılmadı veya yanlış. Resend domain dashboard "Verify" yeşil mi?

### "404 on /api/payment/init"
Vercel build'de **API routes** dahil mi? `Functions` dashboard'unda görmelisin.

### DNS yayılmıyor
24 saat bekle. Bazı ISP'ler agressive cache yapar. Mobile data ile tekrar test et.

---

## 📞 Destek hattı (deploy esnasında)

- Vercel: https://vercel.com/help (chat var, Pro plan'da öncelik)
- Supabase: https://supabase.com/dashboard → Support
- Resend: support@resend.com
- PayTR: 0850 222 7 728 (mesai içi) · destek@paytr.com

---

## ✅ Post-deploy checklist

```
[ ] https://pimetiket.com açılıyor (HTTPS, ✓ green padlock)
[ ] Auth: magic link gelir, link tıklayınca panelime düşer
[ ] Sticker: 25 adetten siparişe kadar uçtan uca akış
[ ] Etiket: 1000 adetten siparişe kadar uçtan uca akış
[ ] Tasarım upload: temp → mockup → siparişle promote
[ ] PayTR: test kart `4355 0843 5508 4358` ile test sipariş (test_mode=1)
[ ] PayTR Bildirim URL panelden set edildi
[ ] Production'a alırken PAYTR_TEST_MODE=0 yapıldı
[ ] Mail: order_confirmation Inbox'a düşer (Spam değil)
[ ] /admin/audit-log: ödeme + dosya event'leri görünür
[ ] Mobile (telefon): hamburger menu, mockup, ödeme akışı OK
[ ] /odeme tek-sayfa: smart defaults (1 adres seçili, fatura "fiş")
```

Hepsi yeşilse production hazır 🚀
