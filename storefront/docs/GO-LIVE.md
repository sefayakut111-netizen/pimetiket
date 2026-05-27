# Pim Etiket — Canlıya Alma Checklist

Son güncelleme: Mayıs 2026 · Domain: `pimetiket.com` · Hosting: Vercel · DB: Supabase (`pimetiket-prod`)

Detaylı adım adım rehber için kök dizindeki `GO-LIVE.md` dosyasına da bakılabilir.

---

## 1. Supabase Production

- [ ] Supabase'de production projesi oluştur (`pimetiket-prod`, Region: Frankfurt)
- [ ] `supabase/migrations/` altındaki migration'ları sırayla uygula (001 → 109)
- [ ] Storage bucket'ları oluştur: `designs` (30MB), `return-photos` (10MB), `public-assets` (5MB)
- [ ] Auth → URL Configuration: Site URL = `https://pimetiket.com`
- [ ] Auth → URL Configuration: Redirect URLs = `https://pimetiket.com/**`

## 2. Vercel Environment Variables

Tüm değişkenler için referans: `.env.example`

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `PAYTR_MERCHANT_ID` + `PAYTR_MERCHANT_KEY` + `PAYTR_MERCHANT_SALT`
- [ ] `PAYTR_TEST_MODE=0` (canlı tahsilat)
- [ ] `OPENAI_API_KEY`
- [ ] `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET`
- [ ] `CRON_SECRET`
- [ ] `NEXT_PUBLIC_SITE_URL=https://pimetiket.com`
- [ ] (Opsiyonel) `YURTICI_USERNAME` + `YURTICI_PASSWORD`
- [ ] (Opsiyonel) R2 archive env'leri

## 3. DNS

- [ ] GoDaddy: `pimetiket.com` A record → Vercel (`76.76.21.21`)
- [ ] `www.pimetiket.com` CNAME → `cname.vercel-dns.com`
- [ ] Resend DNS kayıtları (SPF, DKIM, DMARC)
- [ ] SSL otomatik (Vercel)

## 4. Smoke Test

- [ ] Anasayfa açılıyor (`https://pimetiket.com`)
- [ ] `/sticker` konfigüratör çalışıyor
- [ ] `/etiket` konfigüratör çalışıyor
- [ ] Sepete ekleme çalışıyor
- [ ] Ödeme sayfası açılıyor (PayTR iframe veya psp_unavailable mesajı)
- [ ] Admin panel erişilebilir (`/admin`)
- [ ] Partner panel erişilebilir (`/partner`)
- [ ] Pim sohbet çalışıyor
- [ ] E-posta gönderimi çalışıyor (sipariş onay maili)
- [ ] `/sitemap.xml` ve `/robots.txt` erişilebilir

## 5. İlk Admin Ayarları

- [ ] Admin şifre değiştir
- [ ] Fiyatları kontrol et ve kaydet
- [ ] Test siparişi ver + tüm akışı doğrula (ödeme → QC → onay → fason)
- [ ] PayTR bildirim URL: `https://pimetiket.com/api/payment/callback`
- [ ] Resend webhook URL: `https://pimetiket.com/api/webhooks/resend`

## 6. Production Build

Deploy öncesi local kontrol:

```bash
npx tsc --noEmit
npm run build
```

Vercel → Settings → Functions → Region: `Frankfurt (fra1)` (Türkiye'ye en yakın).
