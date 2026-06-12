/**
 * Playwright config — Pim Etiket E2E hata-tarayıcı bot.
 *
 * Sefa 18 May v68:
 * Bu config production veya local'de çalışan Pim Etiket'i otomatik gezerek
 * hataları (HTTP 4xx/5xx, console errors, JS exceptions, network failures)
 * yakalar.
 *
 * Kullanım:
 *   npm run bot:smoke        — Tüm senaryoları görsel modda çalıştır (Sefa izler)
 *   npm run bot:headless     — Headless modda (CI için)
 *   npm run bot:customer     — Sadece kullanıcı senaryosu
 *   npm run bot:admin        — Sadece admin senaryosu
 *   npm run bot:report       — Son rapor HTML'ini aç
 *
 * Auth: tests/auth.setup.ts Supabase service_role ile session cookie üretir.
 * Manuel login gerekmez — bot direkt auth'lu olarak başlar.
 */

import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "https://pimetiket.com";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Sırayla — admin/customer karışmasın
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Tek worker (auth state karışmasın)
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry", // Hata olunca trace.zip kaydedilir
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth state hazırlığı (tek seferlik setup)
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // Kullanıcı (customer) senaryoları
    {
      name: "customer",
      testMatch: /customer-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/customer.json",
      },
      dependencies: ["setup"],
    },

    // Admin senaryoları
    {
      name: "admin",
      testMatch: /admin-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/admin.json",
      },
      dependencies: ["setup"],
    },

    // Konfigüratör matrisi — auth gerektirmez (public yapılandırıcı)
    {
      name: "product",
      testMatch: /(customer-(product-matrix|sarim-step-order)|editor-bridge-contract)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  outputDir: "test-results/",
});
