/**
 * Pim Etiket Bot — Customer Journey
 *
 * Sefa 18 May v68:
 * Auth'lu kullanıcı olarak siteyi gezer, hataları yakalar. Her sayfada:
 *   - HTTP error (4xx/5xx response)
 *   - Console errors (window.onerror, unhandled rejection)
 *   - Network failures (request failed)
 *   - React error boundary tetiklenmesi
 *
 * Sipariş akışını da test eder AMA **ödeme adımında DURUR** — gerçek para
 * çekilmesini engellemek için. Sepete kadar gider.
 */

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

// ============================================================
// Hata yakalama yardımcısı — her test bunu kurar
// ============================================================
function attachErrorTracking(page: Page, errors: string[]) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Bilinen zararsız uyarıları filtrele
      if (
        text.includes("Download the React DevTools") ||
        text.includes("[Fast Refresh]") ||
        text.includes("DevTools")
      ) {
        return;
      }
      errors.push(`[console.error] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    // Bilinen 3rd-party fail'leri filtrele
    if (
      url.includes("posthog.com") ||
      url.includes("sentry.io") ||
      url.includes("google-analytics") ||
      url.includes("googletagmanager")
    ) {
      return;
    }
    errors.push(
      `[requestfailed] ${req.method()} ${url} — ${req.failure()?.errorText}`
    );
  });

  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    // 4xx/5xx ama bilinen API beklenen 404/401'leri (probe endpoints) filtrele
    if (status >= 400 && status < 600) {
      if (
        url.includes("/api/auth/session") && status === 401 // anonim probe
      )
        return;
      if (url.includes("posthog.com") || url.includes("sentry.io")) return;
      errors.push(`[http ${status}] ${res.request().method()} ${url}`);
    }
  });
}

// ============================================================
// 1. ANASAYFA + NAVİGASYON
// ============================================================
test("Customer: Anasayfa açılır + 4 ana link tıklanabilir", async ({
  page,
}) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });

  // Header'da 4 ana link bulunmalı
  const navLinks = ["Etiket", "Sticker", "Fiyatlandırma", "SSS"];
  for (const label of navLinks) {
    const link = page
      .getByRole("link", { name: new RegExp(label, "i") })
      .first();
    await expect(link).toBeVisible({ timeout: 5_000 });
  }

  // Critical viewport screenshot
  await page.screenshot({ path: "test-results/customer-home.png" });

  // Hata raporu
  if (errors.length > 0) {
    console.log("Anasayfa errors:", errors);
  }
  expect(errors, `Anasayfa hatasız olmalı:\n${errors.join("\n")}`).toEqual([]);
});

// ============================================================
// 2. ETİKET KONFİGÜRATÖRÜ
// ============================================================
test("Customer: /etiket konfigüratör tüm adımlar açılır", async ({ page }) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/etiket");
  await expect(page).toHaveURL(/\/etiket/);

  // Stepper veya başlık görünmeli
  await expect(page.locator("body")).toContainText(/Etiket|Adım|Tür/i, {
    timeout: 10_000,
  });

  // Bir form seçeneği var mı (rulo veya tabaka)
  const ruloOption = page
    .getByText(/Rulo|rulo/i)
    .first();
  await expect(ruloOption).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: "test-results/customer-etiket.png" });

  expect(errors, `/etiket hatasız olmalı:\n${errors.join("\n")}`).toEqual([]);
});

// ============================================================
// 3. STICKER KONFİGÜRATÖRÜ
// ============================================================
test("Customer: /sticker konfigüratör açılır", async ({ page }) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/sticker");
  await expect(page).toHaveURL(/\/sticker/);

  await expect(page.locator("body")).toContainText(/Sticker|sticker|Kesim/i, {
    timeout: 10_000,
  });

  await page.screenshot({ path: "test-results/customer-sticker.png" });

  expect(errors, `/sticker hatasız olmalı:\n${errors.join("\n")}`).toEqual([]);
});

// ============================================================
// 4. SSS + FIYATLANDIRMA + İLETİŞİM (statik sayfalar)
// ============================================================
test("Customer: Statik sayfalar açılır", async ({ page }) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  const pages = [
    { url: "/sss", text: /sıkça|soru|cevap/i },
    { url: "/fiyatlandirma", text: /fiyat/i },
    { url: "/iletisim", text: /iletişim|e-posta|whatsapp/i },
    { url: "/hakkimizda", text: /hakkımızda|biz/i },
    { url: "/blog", text: /blog|yazı/i },
    { url: "/yasal", text: /yasal|kvkk|gizlilik/i },
  ];

  for (const p of pages) {
    await page.goto(p.url);
    await expect(page.locator("body")).toContainText(p.text, {
      timeout: 8_000,
    });
  }

  expect(
    errors,
    `Statik sayfalar hatasız olmalı:\n${errors.join("\n")}`
  ).toEqual([]);
});

// ============================================================
// 5. KULLANICI PANELİ
// ============================================================
test("Customer: /panelim erişimi + alt sayfalar", async ({ page }) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/panelim");
  await expect(page).toHaveURL(/\/panelim/);

  // Auth'lu panel görünmeli (login redirect olmamalı)
  await expect(page).not.toHaveURL(/\/giris|\/login/);

  // Alt sayfaları sırayla dolaş
  const subPages = [
    "/panelim/siparislerim",
    "/panelim/profil",
    "/panelim/adres",
    "/panelim/bildirim-tercihleri",
  ];

  for (const sub of subPages) {
    await page.goto(sub);
    await expect(page).not.toHaveURL(/\/giris|\/login/);
  }

  await page.screenshot({ path: "test-results/customer-panel.png" });

  expect(errors, `Panel hatasız olmalı:\n${errors.join("\n")}`).toEqual([]);
});

// ============================================================
// 6. SEPETE EKLE (ödeme öncesi son adım)
// ============================================================
test.skip("Customer: Etiket konfigüre + sepete ekle (ödeme öncesi DUR)", async ({
  page,
}) => {
  // TODO: Konfigüratör adımları stabilize olunca aç. Şu an akış değişiyor.
  // Bot adımları:
  //   1. /etiket → Rulo seç
  //   2. Malzeme seç
  //   3. Boyut → default
  //   4. Adet → min
  //   5. Sepete ekle
  //   6. /sepet sayfasında ürün var mı doğrula
  //   7. STOP — "Ödemeye geç" butonuna basma
});
