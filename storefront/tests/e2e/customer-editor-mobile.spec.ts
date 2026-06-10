/**
 * Editör mobil düzen — 390px viewport.
 * /editor giriş gerektirir — customer storageState (setup project).
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08,
  0x08, 0x06, 0x00, 0x00, 0x00, 0xc4, 0x0f, 0xbe, 0x8b, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

test.use({ viewport: { width: 390, height: 844 } });

test("Editor mobil: canvas, yükleme, akordeon, Pim sheet", async ({ page }) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    localStorage.setItem("pim_editor_onboarded", "1");
  });

  await page.goto("/editor", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 10_000 });

  const cookieAccept = page.getByRole("button", { name: "Hepsini kabul et" });
  if (await cookieAccept.isVisible().catch(() => false)) {
    await cookieAccept.click();
  }

  const iframe = page.locator('iframe[title="Bıçak editörü"]').first();
  await expect(iframe).toBeVisible({ timeout: 45_000 });

  const iframeBox = await iframe.boundingBox();
  expect(iframeBox?.height ?? 0).toBeGreaterThanOrEqual(300);

  const pngPath = path.join(os.tmpdir(), `pim-mobile-${Date.now()}.png`);
  fs.writeFileSync(pngPath, TINY_PNG);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Dosya yükle veya sürükle/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(pngPath);
  fs.unlinkSync(pngPath);

  await expect(
    page.getByText(/Tasarım yüklendi|Bıçak hazır|kontur hesaplanıyor/i).first()
  ).toBeVisible({ timeout: 45_000 });

  await page
    .locator('button[aria-expanded]')
    .filter({ hasText: /^Bıçak$/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Özel kesim" }).first()
  ).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Pim asistanını aç" }).click();
  await expect(page.getByRole("dialog", { name: "Pim asistanı" })).toBeVisible();
  await expect(page.getByPlaceholder("1 lira boyutu, yuvarlak kes…")).toBeVisible();
});
