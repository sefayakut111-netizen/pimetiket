Sistemi production'a hazırla. Aşağıdaki adımları sırayla uygula.

## ADIM 1 — .env.example dosyası oluştur

Projede `.env.example` yoksa oluştur. Tüm gerekli env var'ları listele. Mevcut kodda kullanılan env var'ları tara (`process.env.` ve `NEXT_PUBLIC_` araması yap) ve eksiksiz listele:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# PayTR
PAYTR_MERCHANT_ID=
PAYTR_MERCHANT_KEY=
PAYTR_MERCHANT_SALT=
PAYTR_OK_URL=https://pimetiket.com/api/payment/callback
PAYTR_FAIL_URL=https://pimetiket.com/api/payment/callback

# OpenAI (AI tasarım kontrolü + Pim sohbet)
OPENAI_API_KEY=sk-...

# Resend (e-posta)
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...

# Cron
CRON_SECRET=

# Site
NEXT_PUBLIC_SITE_URL=https://pimetiket.com

# Diğer (varsa)
# ... tüm kullanılan env var'ları tara ve ekle
```

Her değişkenin yanına kısa açıklama yaz (ne için, nereden alınır).

## ADIM 2 — GO-LIVE checklist dosyasını güncelle

`docs/GO-LIVE.md` dosyasını kontrol et (varsa güncelle, yoksa oluştur):

```markdown
# Pim Etiket — Canlıya Alma Checklist

## 1. Supabase Production
- [ ] Supabase'de yeni production projesi oluştur
- [ ] 109 migration'ı sırayla uygula (SQL Editor)
- [ ] Storage bucket'ları oluştur: designs (30MB), return-photos (10MB), public-assets (5MB)
- [ ] Auth → URL Configuration: Site URL = https://pimetiket.com
- [ ] Auth → URL Configuration: Redirect URLs = https://pimetiket.com/**

## 2. Vercel Environment Variables
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] PAYTR_MERCHANT_ID + KEY + SALT
- [ ] OPENAI_API_KEY
- [ ] RESEND_API_KEY + WEBHOOK_SECRET
- [ ] CRON_SECRET
- [ ] NEXT_PUBLIC_SITE_URL = https://pimetiket.com

## 3. DNS
- [ ] GoDaddy: pimetiket.com A record → Vercel
- [ ] www.pimetiket.com CNAME → cname.vercel-dns.com
- [ ] SSL otomatik (Vercel)

## 4. Smoke Test
- [ ] Anasayfa açılıyor
- [ ] /sticker konfigüratör çalışıyor
- [ ] /etiket konfigüratör çalışıyor
- [ ] Sepete ekleme çalışıyor
- [ ] Ödeme sayfası açılıyor (PayTR iframe)
- [ ] Admin panel erişilebilir
- [ ] Pim sohbet çalışıyor
- [ ] E-posta gönderimi çalışıyor

## 5. İlk Admin Ayarları
- [ ] Admin şifre değiştir
- [ ] Fiyatları kontrol et ve kaydet
- [ ] Test siparişi ver + tüm akışı doğrula
```

## ADIM 3 — Production build kontrol

```bash
npx tsc --noEmit
npm run build
```

Build hatası varsa düzelt. Warning'ler kabul edilebilir ama error olmamalı.

## ADIM 4 — Gereksiz debug log'ları temizle

Koddaki geçici debug log'larını bul ve temizle:
```bash
grep -rn "console.log.*\[promote\]\|console.log.*\[run-order-qc\]\|console.log.*\[cutline-gen\]\|console.log.*\[payment-callback\]\|console.log.*debug" src/ --include="*.ts" --include="*.tsx"
```

`[promote]`, `[run-order-qc]`, `[cutline-gen]`, `[debug]` prefix'li geçici log'ları SİL. Kalıcı hata log'larını (`console.error`) BIRAK.

## ADIM 5 — Gereksiz script dosyalarını temizle

`scripts/` klasöründeki debug/repair script'lerini kontrol et. Production'da gereksiz olanları `.gitignore`'a ekle veya `scripts/dev/` altına taşı:
- `debug-*.mjs` → geliştirme aracı, prod'da gereksiz
- `repair-*.mjs` → bir kerelik fix, prod'da gereksiz
- `test-*.mjs` → test aracı, prod'da gereksiz
- `run-*.ts` → geliştirme aracı

## ADIM 6 — Vercel config kontrol

`vercel.json` dosyasını kontrol et:
- Tüm cron job'lar doğru schedule'da mı?
- `maxDuration` yeterli mi? (payment callback, QC gibi uzun işler için)
- Region doğru mu? (Türkiye için `fra1` veya `cdg1`)

Her adım sonrası commit yap (`chore(launch):` prefix).
