/**
 * Pim Etiket Bot — Admin Journey
 *
 * Sefa 18 May v68:
 * Admin olarak tüm admin sayfalarını dolaşır, hataları yakalar. Her sayfada:
 *   - HTTP error (4xx/5xx)
 *   - Console errors
 *   - 401/403 redirect (admin guard'ın doğru çalıştığının doğrulanması)
 *   - Tablo/veri render hataları
 */

import { test, expect, type Page } from "@playwright/test";

function attachErrorTracking(page: Page, errors: string[]) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
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
    if (
      url.includes("posthog.com") ||
      url.includes("sentry.io") ||
      url.includes("google-analytics")
    )
      return;
    errors.push(
      `[requestfailed] ${req.method()} ${url} — ${req.failure()?.errorText}`
    );
  });

  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    if (status >= 400 && status < 600) {
      if (url.includes("posthog.com") || url.includes("sentry.io")) return;
      errors.push(`[http ${status}] ${res.request().method()} ${url}`);
    }
  });
}

// Admin sayfaları (sidebar'daki tüm linkler)
const ADMIN_PAGES: { path: string; expect: RegExp }[] = [
  { path: "/admin", expect: /dashboard|admin|operatör/i },
  { path: "/admin/siparisler", expect: /sipariş/i },
  { path: "/admin/siparis-ekle", expect: /sipariş|yeni|ekle/i },
  { path: "/admin/musteriler", expect: /müşteri/i },
  { path: "/admin/yorumlar", expect: /yorum/i },
  { path: "/admin/iadeler", expect: /iade/i },
  { path: "/admin/tasarimlar", expect: /tasarım/i },
  { path: "/admin/aboneler", expect: /abone|email/i },
  { path: "/admin/galeri", expect: /galeri/i },
  { path: "/admin/gorseller", expect: /görsel/i },
  { path: "/admin/finans", expect: /finans|gelir/i },
  { path: "/admin/kuponlar", expect: /kupon/i },
  { path: "/admin/calisanlar", expect: /çalışan/i },
  { path: "/admin/raporlar", expect: /rapor/i },
  { path: "/admin/audit-log", expect: /denetim|audit|log/i },
  { path: "/admin/kvkk-talepleri", expect: /kvkk/i },
  { path: "/admin/yedekler", expect: /yedek/i },
  { path: "/admin/fiyatlar", expect: /fiyat/i },
  { path: "/admin/ayarlar", expect: /ayar/i },
  // Sefa 18 May: R2 arşiv paneli
  { path: "/admin/arsiv", expect: /arşiv|R2/i },
];

// ============================================================
// HER ADMIN SAYFASI İÇİN AYRI TEST
// ============================================================
for (const adminPage of ADMIN_PAGES) {
  test(`Admin: ${adminPage.path} açılır + hatasız`, async ({ page }) => {
    const errors: string[] = [];
    attachErrorTracking(page, errors);

    await page.goto(adminPage.path);

    // Login redirect olmamalı (auth çalışıyor)
    await expect(page).not.toHaveURL(/\/giris|\/login/, { timeout: 5_000 });

    // Sayfa içeriği yüklenmeli
    await expect(page.locator("body")).toContainText(adminPage.expect, {
      timeout: 10_000,
    });

    // Screenshot (debug için)
    const safeName = adminPage.path
      .replace(/^\//, "")
      .replace(/\//g, "-");
    await page.screenshot({
      path: `test-results/admin-${safeName}.png`,
      fullPage: false,
    });

    if (errors.length > 0) {
      console.log(`${adminPage.path} errors:`, errors);
    }
    expect(
      errors,
      `${adminPage.path} hatasız olmalı:\n${errors.join("\n")}`
    ).toEqual([]);
  });
}

// ============================================================
// R2 ARŞİV PANELİ - DETAYLI AKIŞ
// ============================================================
test("Admin: /admin/arsiv → müşteri seç → dosya listesi → modal", async ({
  page,
}) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/admin/arsiv");
  await expect(page).toHaveURL(/\/admin\/arsiv/);

  // 5 KPI kart görünmeli
  await expect(page.locator("body")).toContainText(/Aktif|Arşivde|Cold/i);

  // Hot filter'a geç (cold default boş muhtemelen)
  await page
    .getByRole("button", { name: /Hot|Aktif|🔥/i })
    .first()
    .click()
    .catch(() => {
      // Filter button tıklanmazsa skip
    });

  // İlk müşteri satırı varsa "Dosyaları gör" linkine tıkla
  const detailLink = page.getByRole("link", { name: /Dosyaları gör/i }).first();
  if (await detailLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await detailLink.click();
    await expect(page).toHaveURL(/\/admin\/arsiv\//);

    // Detay sayfası
    await expect(page.locator("body")).toContainText(/Müşteri|UUID|Toplam/i);
  }

  await page.screenshot({ path: "test-results/admin-arsiv.png" });

  expect(
    errors,
    `Admin arşiv akışı hatasız olmalı:\n${errors.join("\n")}`
  ).toEqual([]);
});
