# Sentry Kurulum — Sefa Checklist

> Süre: **3 dakika**
> Maliyet: **Free** (5K event/ay Developer plan)
> Faydası: Production'da müşterinin gördüğü hatayı sen 30 saniye içinde öğrenirsin

Bu dosya tek seferlik. Tamamladıktan sonra silebilirsin.

---

## Niye Sentry?

- Müşteri sitenizde bir hata ile karşılaştığında: **sen anında bilmen lazım**, kullanıcı şikayet etmeden önce
- Hangi sayfada, hangi tarayıcıda, hangi adımda patladı → otomatik raporlanır
- Session replay: hata anında müşterinin tıklama videosunu izlersin
- Kod tarafı ZATEN kurulu (3 config dosyası + `@sentry/nextjs` paketi)
- DSN env eklenince **anında aktif**

---

## 1. Hesap aç (1 dk)

1. https://sentry.io/signup adresine git
2. Email + Google login
3. Organization adı: `pimetiket` (canın isterse `pim-etiket`)
4. **EU region seç** (KVKK için zorunlu — data residency Frankfurt'ta)

## 2. Project oluştur (1 dk)

1. "Create Project" → **Platform: Next.js** seç
2. Alert frequency: "On every new issue" (default)
3. Project name: `pimetiket-prod`
4. Team: `#pimetiket` (default)
5. **Create Project** → DSN ekranına yönlendirir

## 3. DSN'i kopyala (30 sn)

DSN şu formatta olur:
```
https://abc123xyz@o123456.ingest.de.sentry.io/789012
```

Bunu kopyala — Vercel'e koyacaksın.

## 4. Vercel env'e ekle (30 sn)

Vercel dashboard → Pim Etiket → **Settings → Environment Variables**:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | (az önce kopyaladığın DSN) | Production, Preview |
| `SENTRY_AUTH_TOKEN` | (Sentry → User Settings → Auth Tokens → Create) — source map upload için | Production |
| `SENTRY_ORG` | `pimetiket` | Production |
| `SENTRY_PROJECT` | `pimetiket-prod` | Production |

**Save** → Vercel otomatik deploy başlar (~40 sn).

## 5. Doğrula (30 sn)

Deploy bitince:

1. https://pimetiket.com adresine git
2. F12 → Console:
   ```js
   Sentry.captureException(new Error("Sefa test hatası"))
   ```
3. Sentry dashboard → **Issues** → 5-10 sn içinde "Sefa test hatası" görünmeli

---

## Otomatik track ettiğimiz hata türleri

Kod zaten şunları yakalar (DSN olunca aktif):

- ✅ Tüm uncaught exception'lar
- ✅ Unhandled promise rejection'lar
- ✅ React Error Boundary
- ✅ Next.js server-side errors
- ✅ Edge function hataları
- ✅ Session replay (sadece hata anında, %0 normal oturumda — privacy + maliyet)

## Filtrelenen gürültü (gönderilmez)

```typescript
ignoreErrors: [
  "ResizeObserver loop limit exceeded",   // browser eklentisi
  "NetworkError",                          // kullanıcı offline
  "Failed to fetch",                       // kullanıcı offline
  "ChunkLoadError",                        // Next.js HMR
]
```

---

## Sefa için günlük 1 dk Sentry

Her sabah Sentry → **Issues** sekmesine bak:

- **Yeni issue varsa**: tıkla, breadcrumbs'a bak (hata öncesi son 50 tıklama otomatik kayıt) → düzelt
- **Aynı issue tekrar geliyorsa**: priority artıyor demektir, bugün düzelt
- **Resolve** butonuyla işaretle → çözüldüğünü Sentry öğrenir

## Slack / Email entegrasyonu (opsiyonel)

Sentry → **Settings → Integrations**:
- **Slack**: Critical hatalar Slack kanalına bildirim
- **Email**: Sadece "First seen" event'lerinde mail (spam değil)

İlk başta email yeter — Slack daha sonra ekleyebilirsin.

---

## Source map upload (otomatik)

`SENTRY_AUTH_TOKEN` env'i koyduğunda Vercel build sırasında source map'leri Sentry'ye yükler. Bu sayede:

- Sentry'de **gerçek kod satırı** görürsün ("`app/odeme/page.tsx:142`")
- Minified bundle'da arama yapmazsın
- Stack trace okunabilir hale gelir

`SENTRY_AUTH_TOKEN` koymazsan da hatalar yakalanır ama satır numaraları yanlış olur.

---

## Maliyet

- **Developer Free**: 5.000 error event + 10.000 transaction + 50 replay/ay
- Sefa için RAHATLIKLA yeter (bağlı: ayda 50 sipariş → muhtemelen <100 error)
- Kotaya yaklaşırsan Sentry email atar, sample rate düşür veya `$26/ay` Team plan'a geç

---

## Sorun olursa

- DSN'i kontrol et: `https://` ile başlamalı, `@o...ingest.de.sentry.io/...` formatında
- Vercel env'de "Production" işaretli mi
- Deploy tamamlandı mı (Vercel dashboard'da yeşil ✓ olmalı)
- AdBlock kapalı mı (Sentry'yi bloklayabilir)

Test event yine de görünmüyorsa: Sentry → **Project Settings → Client Keys (DSN)** → "Validate" tuşu var, kullan.

---

Bu kadar. 3 dakikada Sentry aktif, production hataları otomatik yakalanıyor.
