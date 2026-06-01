/**
 * 22 ürün matrisi — etiket + sticker yapılandırıcı smoke.
 * Auth gerekmez; production veya local base URL.
 */
import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

const ETIKET_PRODUCTS = [
  { id: "E1", path: "/etiket/yapilandir?form=rulo&shape=diecut", steps: 7 },
  { id: "E2", path: "/etiket/yapilandir?form=rulo&shape=clear", steps: 7 },
  { id: "E3", path: "/etiket/yapilandir?form=rulo&shape=circle", steps: 7 },
  { id: "E4", path: "/etiket/yapilandir?form=rulo&shape=square", steps: 7 },
  { id: "E5", path: "/etiket/yapilandir?form=rulo&shape=rectangle", steps: 7 },
  { id: "E6", path: "/etiket/yapilandir?form=rulo&shape=oval", steps: 7 },
  { id: "E7", path: "/etiket/yapilandir?form=tabaka&shape=circle", steps: 5 },
  { id: "E8", path: "/etiket/yapilandir?form=tabaka&shape=diecut", steps: 5 },
  { id: "E9", path: "/etiket/yapilandir?form=tabaka&shape=oval", steps: 5 },
  { id: "E10", path: "/etiket/yapilandir?form=tabaka&shape=rectangle", steps: 5 },
  { id: "E11", path: "/etiket/yapilandir?form=tabaka&shape=square", steps: 5 },
];

const STICKER_PRODUCTS = [
  { id: "S1", path: "/sticker/yapilandir?cut=diecut&shape=diecut", steps: 5 },
  { id: "S2", path: "/sticker/yapilandir?cut=diecut&shape=circle", steps: 5 },
  { id: "S3", path: "/sticker/yapilandir?cut=diecut&shape=rectangle", steps: 5 },
  { id: "S4", path: "/sticker/yapilandir?cut=diecut&shape=square", steps: 5 },
  { id: "S5", path: "/sticker/yapilandir?cut=diecut&shape=oval", steps: 5 },
  { id: "S6", path: "/sticker/yapilandir?cut=diecut&shape=bumper", steps: 5 },
  { id: "S7", path: "/sticker/yapilandir?cut=kisscut&shape=diecut", steps: 5 },
  { id: "S8", path: "/sticker/yapilandir?cut=diecut&shape=diecut&material=transparan", steps: 5 },
  { id: "S9", path: "/sticker/yapilandir?cut=diecut&shape=diecut&material=holo", steps: 5 },
  { id: "S10", path: "/sticker/yapilandir?cut=diecut&shape=diecut&material=simli", steps: 5 },
  { id: "S11", path: "/sticker/yapilandir?cut=tabaka&shape=square", steps: 5 },
];

function attachErrorTracking(page: Page, errors: string[]) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      text.includes("Download the React DevTools") ||
      text.includes("[Fast Refresh]") ||
      text.includes("DevTools")
    ) {
      return;
    }
    errors.push(`[console.error] ${text}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (
      url.includes("posthog.com") ||
      url.includes("sentry.io") ||
      url.includes("google-analytics") ||
      url.includes("_rsc=")
    ) {
      return;
    }
    errors.push(`[requestfailed] ${req.method()} ${url}`);
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (url.includes("posthog.com") || url.includes("sentry.io")) return;
    errors.push(`[http ${status}] ${url}`);
  });
}

async function assertConfiguratorLoads(
  page: Page,
  product: { id: string; path: string; steps: number },
  errors: string[]
) {
  await page.goto(product.path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/i, {
    timeout: 15_000,
  });
  await expect(page.locator("#step-1, #step-3").first()).toBeVisible({ timeout: 20_000 });
  const priceText = page.locator('[class*="PriceCard"], [data-testid="price-card"]').first();
  const bodyHasPrice = page.locator("body");
  await expect(bodyHasPrice).toContainText(/₺|TL|0,\d{2}/i, { timeout: 25_000 });
  const stepSections = page.locator('[id^="step-"]:visible');
  const count = await stepSections.count();
  expect(count, `${product.id} visible step count`).toBeGreaterThanOrEqual(Math.min(product.steps, 4));
  expect(errors, `${product.id} runtime errors`).toEqual([]);
}

for (const product of ETIKET_PRODUCTS) {
  test(`Etiket ${product.id}: ${product.path}`, async ({ page }) => {
    const errors: string[] = [];
    attachErrorTracking(page, errors);
    await assertConfiguratorLoads(page, product, errors);
  });
}

for (const product of STICKER_PRODUCTS) {
  test(`Sticker ${product.id}: ${product.path}`, async ({ page }) => {
    const errors: string[] = [];
    attachErrorTracking(page, errors);
    await assertConfiguratorLoads(page, product, errors);
  });
}

test("Sticker S6 edge: empty form param bumper — duplicate id kontrolü", async ({
  page,
}) => {
  const errors: string[] = [];
  attachErrorTracking(page, errors);
  await page.goto("/sticker/yapilandir?form=&shape=bumper", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("body")).not.toContainText(/Application error/i);
  await expect(page.getByRole("heading", { name: /Bumper/i })).toBeVisible({
    timeout: 20_000,
  });
  const step3Count = await page.locator("#step-3").count();
  expect(step3Count, "duplicate #step-3 DOM id (locale hydration?)").toBe(1);
  expect(errors).toEqual([]);
});

test("Etiket grid: yapılandırıcı kart linkleri", async ({ page }) => {
  await page.goto("/etiket");
  const links = page.locator('a[href*="/etiket/yapilandir"]');
  await expect(links.first()).toBeVisible({ timeout: 15_000 });
  const count = await links.count();
  expect(count, "etiket kart sayısı").toBeGreaterThanOrEqual(11);
});

test("Sticker grid: yapılandırıcı kart linkleri", async ({ page }) => {
  await page.goto("/sticker");
  const links = page.locator('a[href*="/sticker/yapilandir"]');
  await expect(links.first()).toBeVisible({ timeout: 15_000 });
  const count = await links.count();
  expect(count, "sticker kart sayısı").toBeGreaterThanOrEqual(11);
});

function parseUnitPriceTr(text: string): number | null {
  const match = text.match(/Birim fiyat\s+([\d.,]+)\s*₺\/adet/i);
  if (!match) return null;
  return parseFloat(match[1].replace(/\./g, "").replace(",", "."));
}

async function readStickerUnitPrice(page: Page): Promise<number> {
  await expect(page.locator("body")).toContainText(/Birim fiyat/i, {
    timeout: 25_000,
  });
  const text = await page.locator("body").innerText();
  const unit = parseUnitPriceTr(text);
  if (unit == null || Number.isNaN(unit)) {
    throw new Error("Birim fiyat parse edilemedi");
  }
  return unit;
}

test("Sticker kesim fiyat oranı: diecut ≈ kisscut × 1.10", async ({ page }) => {
  const base =
    "/sticker/yapilandir?shape=diecut&material=vinil&form=rulo";

  await page.goto(`${base}&cut=kisscut`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await expect(page.locator("#step-1, #step-3").first()).toBeVisible({
    timeout: 20_000,
  });
  const kisscutUnit = await readStickerUnitPrice(page);

  await page.goto(`${base}&cut=diecut`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await expect(page.locator("#step-1, #step-3").first()).toBeVisible({
    timeout: 20_000,
  });
  const diecutUnit = await readStickerUnitPrice(page);

  const ratio = diecutUnit / kisscutUnit;
  expect(ratio, "diecut/kisscut birim fiyat oranı").toBeGreaterThanOrEqual(1.08);
  expect(ratio, "diecut/kisscut birim fiyat oranı").toBeLessThanOrEqual(1.12);
});
