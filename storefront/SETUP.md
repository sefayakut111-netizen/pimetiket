# Pim Etiket — Kurulum kılavuzu

P0 backend stack'i (DB + Auth + Ödeme + Mail + Storage) **uçtan uca çalışıyor**. Bu kılavuz Sefa'nın env'leri doldurup canlıya alması içindir.

**Toplam süre**: ~90 dakika · 6 adım.

---

## 0. Gereksinimler (3 dk)

```bash
# Repo zaten klonlu, dependencies kurulu olmalı
cd storefront
npm install   # eğer kurmadıysan
```

`.env.local` oluştur:

```bash
cp .env.example .env.local
```

---

## 1. Supabase (25 dk)

### 1.1 Proje aç

1. https://supabase.com/dashboard → **New Project**
2. **Region**: `Frankfurt (eu-central-1)` (TR'ye en yakın, KVKK uyumlu)
3. **Project Name**: `pimetiket-prod` (test için `pimetiket-dev` ayrı bir proje aç)
4. **Database Password**: güçlü şifre — password manager'a kaydet
5. **Plan**: ücretsiz başla; 1.000 aktif kullanıcı/aylık aşılırsa Pro ($25/ay)

### 1.2 API anahtarları

`Project Settings → API` aç:

```env
# .env.local içine
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# ⚠️ SADECE server-side, ASLA NEXT_PUBLIC_ koyma
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### 1.3 Migration push

7 SQL dosyası var, sırayla çalıştırılmalı.

**Yöntem A: Supabase Dashboard** (kolay)

1. Dashboard → **SQL Editor → New query**
2. Sırayla yapıştır + **Run** (Ctrl+Enter):

| Sıra | Dosya | Tablolar |
|------|-------|----------|
| 1 | `supabase/migrations/001_initial_schema.sql` | profiles + addresses + cart_items + orders + order_items + wallet_transactions |
| 2 | `supabase/migrations/002_invoice_events_payments.sql` | order_events + payments + fn_create_order |
| 3 | `supabase/migrations/003_returns_design_files.sql` | returns + design_files |
| 4 | `supabase/migrations/004_notifications_audit.sql` | notification_prefs + audit_log |
| 5 | `supabase/migrations/005_coupons_reviews.sql` | coupons + coupon_uses + reviews |
| 6 | `supabase/migrations/006_storage_buckets.sql` | Storage RLS policies |
| 7 | `supabase/migrations/007_payment_intents.sql` | payment_intents |

**Yöntem B: Otomatik script**

```bash
npm run migrate
```

(`SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` `.env.local`'de olmalı.)

### 1.4 Storage bucket'ları (manuel)

Migration 006 sadece policy yazar — bucket'ları **manuel** açman lazım.

`Storage → New bucket`:

| Bucket adı | Public | File size limit | Allowed MIME types |
|-----------|--------|----------------|-------------------|
| `designs` | OFF | `30 MB` | `application/pdf, image/png, image/jpeg, image/svg+xml, application/postscript, application/illustrator, image/vnd.adobe.photoshop` |
| `return-photos` | OFF | `10 MB` | `image/png, image/jpeg, image/webp` |
| `public-assets` | ON | `5 MB` | `image/png, image/jpeg, image/webp, image/svg+xml` |

### 1.5 Auth ayarları

`Authentication → URL Configuration`:

| Alan | Değer |
|------|-------|
| Site URL | `http://localhost:3000` (dev) → `https://pimetiket.com` (prod) |
| Redirect URLs | `http://localhost:3000/auth/callback` + `https://pimetiket.com/auth/callback` |

`Authentication → Email Templates → Magic Link`:

- **Subject**: `Pim Etiket'e giriş bağlantın`
- **Body**: hazır şablonu Türkçeleştir, `{{ .ConfirmationURL }}` placeholder'ı bırak

### 1.6 (Opsiyonel) Google OAuth

1. https://console.cloud.google.com → **Create OAuth Client (Web)**
2. **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Client ID + Secret kopyala
4. Supabase: `Authentication → Providers → Google → Enable + paste`

---

## 2. iyzico Sandbox (15 dk)

### 2.1 Hesap aç

1. https://merchant.iyzipay.com/auth/register → kayıt
2. **Sandbox** ortamı: https://sandbox-merchant.iyzipay.com → giriş yap

### 2.2 API anahtarı

`API & Anahtarlarım → Yeni anahtar oluştur` → aktivasyonu sağla.

```env
IYZICO_API_KEY=sandbox-...
IYZICO_SECRET_KEY=sandbox-...
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com
```

### 2.3 Test kartlar

| Kart | Banka | Sonuç |
|------|-------|-------|
| `5528790000000008` | Halkbank | Başarılı 3DS |
| `5168880000000002` | Garanti | Failure |

CVV: `123` · MM/YY: `12/30` · 3DS şifre: `123456`

Tam liste: https://dev.iyzipay.com/tr/test-kartlari

### 2.4 Production'a geçince

```env
IYZICO_API_KEY=prod-...   # gerçek anahtarlar
IYZICO_SECRET_KEY=prod-...
IYZICO_BASE_URL=https://api.iyzipay.com
```

⚠️ Production'da iyzico **manuel onay** gerektirir (1-3 iş günü).

---

## 3. Resend Mail (10 dk)

### 3.1 Hesap aç

1. https://resend.com → kayıt (ücretsiz: 100 mail/gün, 3.000/ay)
2. `API Keys → Create API Key` → kopyala

### 3.2 Domain doğrulama

`Domains → Add Domain`:

- `pimetiket.com` ekle
- Resend sana 4 DNS kaydı verir (DKIM, SPF, MX vb)
- DNS panelinde ekle (Cloudflare/GoDaddy)
- 1-2 saat içinde "Verified" olur

### 3.3 .env

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Pim Etiket <merhaba@pimetiket.com>
```

### 3.4 Domain doğrulanmadıysa

Geçici olarak Resend'in kendi `onboarding@resend.dev` adresini kullan, ama production'da kendi domain şart.

---

## 4. (Opsiyonel) Netgsm SMS (10 dk)

SMS göndermek istiyorsan — yoksa atlayabilirsin, sistem mailden devam eder.

1. https://www.netgsm.com.tr → kurumsal hesap
2. **Onaylı başlık** (header) talep et — `PIMETIKET` veya `PIM ETIKET`
3. API kullanıcı + şifre al

```env
NETGSM_USERCODE=...
NETGSM_PASSWORD=...
NETGSM_HEADER=PIMETIKET
```

---

## 5. (Opsiyonel) OpenAI (Pim AI chat için, 5 dk)

Pim chat agent'ının fiyat hesabı için OpenAI API key:

```env
OPENAI_API_KEY=sk-proj-...
```

Olmadan sayfalar çalışır ama Pim chat balonunda fiyat hesabı yapmaz.

---

## 6. Doğrulama (5 dk)

### 6.1 Health check

```bash
npm run check
```

Output:

```
🔍 Pim Etiket — Health check

✓ NEXT_PUBLIC_SITE_URL              http://localhost:3000
✓ NEXT_PUBLIC_SUPABASE_URL          set
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY     set
✓ SUPABASE_SERVICE_ROLE_KEY         set
✓ Supabase ping                     200 OK
✓ Supabase auth API                 reachable
✓ Migration tables                  15/15 tablo bulundu
○ IYZICO_API_KEY                    set
✓ iyzico ping                       reachable (sandbox)
○ RESEND_API_KEY                    set
✓ Resend ping                       reachable
○ NETGSM_USERCODE                   not set (optional)

Genel durum: 9/10 ✓ — kullanıma hazır.
```

### 6.2 Build

```bash
npm run build
```

`✓ Generating static pages (61/61)` görünmeli.

### 6.3 Dev server

```bash
npm run dev
```

http://localhost:3000 → kontrol akışı:

1. **`/auth`** → e-posta gir → mail gelir → link tıkla → `/panelim`'e döner
2. **`/sticker`** → konfigüre → "Sepete ekle" → cart_items DB'de oluşur
3. **`/sepet`** → "Ödemeye geç" → `/odeme`
4. **`/odeme`** → step 1-3 doldur → "Ödemeye geç" → iyzico hosted form açılır
5. **iyzico'da**: `5528790000000008` / `123` / `12/30` / `123456`
6. **`/odeme-sonuc`** → "Sipariş alındı" → mail kutusuna gelir
7. **`/siparis/<id>`** → tasarım dosyası yükle (PDF) → AI 1.5sn sonra "qc_passed"
8. **`/admin/audit-log`** → ödeme + dosya yükleme event'lerini gör

---

## 🆘 Sık karşılaşılan hatalar

### "permission denied for relation cart_items"
RLS policy çalışmadı. `001_initial_schema.sql` tam çalıştırılmadı — yeniden run.

### "violates foreign key constraint orders_user_id_fkey"
`profiles` satırı yok. `Authentication → Users`'a bak — user var mı? `handle_new_user()` trigger'ı çalışmıyor olabilir, migration 001'i tekrar çalıştır.

### iyzico "API request not authorized"
`IYZICO_API_KEY` yanlış environment'tan kopyalanmış. **Sandbox** key başka, **Production** key başka. Doğru ortamı seç.

### Resend "from address not verified"
Domain doğrulanmamış. Geçici çözüm: `RESEND_FROM_EMAIL=onboarding@resend.dev`. Kalıcı: DNS DKIM/SPF kayıtları doğru girildiğinden emin ol.

### Storage upload "Unauthorized"
Bucket policy migration 006 çalıştırıldı mı? `Storage → designs → Policies` kontrol et — 3 policy görünmeli (upload, read, delete).

### "Module not found: Can't resolve iyzipay/lib/resources"
Turbopack iyzipay'i bundle edemiyor. `next.config.ts`'de `serverExternalPackages: ["iyzipay"]` olduğundan emin ol.

---

## 📚 Kaynaklar

- **Supabase**: https://supabase.com/docs (Auth + Database + Storage rehberleri)
- **iyzico**: https://dev.iyzipay.com (Checkout Form rehberi)
- **Resend**: https://resend.com/docs
- **Netgsm**: https://www.netgsm.com.tr/dokuman

---

## ✅ Bittiğinde

Health check tamamen yeşilse:

- DB → Auth → Cart → Order → iyzico → Mail → Storage → AI ön-kontrol — **uçtan uca çalışıyor**
- Backend P1 (admin CRUD endpoint'leri, e-Fatura, kargo API) için hazırsın
- Production deploy: Cloudflare Pages veya Vercel — `vercel deploy` yeterli (env'ler dashboard'a girilir)

Sefa, sorun yaşadığın noktayı bana yaz, oraya odaklanırız.
