# Pim Etiket E2E Bot (Playwright)

Chrome otomasyonu ile siteyi gezip hataları yakalayan bot.

## Kurulum (bir kez)

```bash
npm install
npx playwright install chromium
```

## Çalıştırma

```bash
# Görsel mode — tarayıcı açılır, sen izlersin
npm run bot:smoke

# Sadece kullanıcı senaryosu
npm run bot:customer

# Sadece admin senaryosu
npm run bot:admin

# Headless mode (görsel olmadan, daha hızlı)
npm run bot:headless

# Son test raporunu HTML olarak aç
npm run bot:report
```

## Ne yakalar?

Her sayfa için otomatik:

- **HTTP error**: 4xx / 5xx response (PostHog/Sentry filtrelenir)
- **Console error**: `console.error()`, unhandled promise rejection, JS exception
- **Page error**: window.onerror tetiklenmesi
- **Network failure**: fetch/XHR fail (ağ kesilmesi vb)
- **Auth redirect**: yanlış yere yönlendirme (örn admin sayfasından `/giris`'e)
- **Eksik içerik**: beklenen başlık/metin yok

## Yapı

```
tests/
├── e2e/
│   ├── auth.setup.ts          ← Supabase magic link ile 2 rol login
│   ├── customer-journey.spec.ts  ← 5 test (anasayfa, konfigüratör, panel, vb)
│   └── admin-journey.spec.ts     ← 20+ test (her admin sayfası)
├── .auth/                     ← session state'ler (gitignore'da)
│   ├── customer.json
│   └── admin.json
└── README.md (bu dosya)

playwright.config.ts           ← root config
playwright-report/             ← HTML rapor (test sonrası)
test-results/                  ← screenshot + trace.zip (hata olunca)
```

## Test kullanıcıları

`.env.local`'da set et (varsayılan değerler):

```env
# Bot için test kullanıcıları
BOT_CUSTOMER_EMAIL=pim-etiket-bot+customer@gmail.com
BOT_ADMIN_EMAIL=sefayakut111@gmail.com
```

- **Customer**: Eğer bu email Supabase'de yoksa **otomatik oluşturulur** (`auth.admin.createUser` + `profiles.role='customer'`)
- **Admin**: Sefa'nın gerçek hesabı — `profiles.role` zaten `'admin'` veya `'staff'` olmalı

## Hata olunca

Test fail olduğunda Playwright şunları kaydeder:

```
test-results/
└── customer-journey-Customer-Anasayfa-açılır/
    ├── test-failed-1.png              ← screenshot
    ├── trace.zip                      ← timeline + network + console
    └── error-context.md               ← Markdown rapor
```

Trace'i açmak için:

```bash
npx playwright show-trace test-results/.../trace.zip
```

→ Browser'da interaktif timeline açılır (timeline tıklayınca DOM snapshot).

## Production vs Local

```bash
# Production (varsayılan)
npm run bot:smoke

# Local (npm run dev'i ayrı terminalde önce başlat)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run bot:smoke
```

## CI entegrasyonu (gelecek)

`.github/workflows/bot.yml` ile her PR'da otomatik çalıştırılabilir. Şu an manuel.

## Bilinen limitler

1. **Ödeme akışı test edilmez** — bot sepete kadar gider, "Ödemeye geç" butonuna basmaz (gerçek PayTR çağrısı engellenmek için)
2. **Magic link rate limit** — Supabase saatte ~5 magic link/email izin verir. Sık çalıştırırsan storageState cache'i kullan
3. **Visual regression yok** — sadece içerik / hata kontrolü. Screenshot karşılaştırma yok (Sefa eklemek istiyorsa `toHaveScreenshot()` ile ekleyebilir)
4. **3rd party hataları filtreli** — PostHog, Sentry, Google Analytics fail'leri görmezden gelinir

## Yeni test ekleme

`tests/e2e/customer-journey.spec.ts` veya `admin-journey.spec.ts`'e yeni `test(...)` ekle. Pattern:

```ts
test("Açıklayıcı isim", async ({ page }) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/yeni-sayfa");
  await expect(page.locator("body")).toContainText(/beklenen/i);

  expect(errors).toEqual([]);
});
```
