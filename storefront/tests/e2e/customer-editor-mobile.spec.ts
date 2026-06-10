/**
 * Editör mobil düzen — 390px viewport.
 * /editor giriş gerektirir — customer storageState (setup project).
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

const EDITOR_FIXTURE = path.resolve("tests/fixtures/editor-bot.png");

test.use({ viewport: { width: 390, height: 844 } });

test("Editor mobil: canvas, yükleme, akordeon, Pim sheet", async ({ page }) => {
  test.setTimeout(180_000);

  await page.addInitScript(() => {
    localStorage.setItem("pim_editor_onboarded", "1");
  });

  await page.goto("/editor", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

  const cookieAccept = page.getByRole("button", { name: "Hepsini kabul et" });
  if (await cookieAccept.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await cookieAccept.click();
  }

  const iframe = page.locator('iframe[title="Bıçak editörü"]').first();
  await expect(iframe).toBeVisible({ timeout: 60_000 });

  const iframeBox = await iframe.boundingBox();
  expect(iframeBox?.height ?? 0).toBeGreaterThanOrEqual(300);

  const pocFrame = page.frameLocator('iframe[title="Bıçak editörü"]').first();
  await expect(pocFrame.locator("#canvas")).toBeAttached({ timeout: 90_000 });

  await expect(
    page.getByText("Görsel yükle — bıçak otomatik netleşir")
  ).toBeVisible({ timeout: 90_000 });

  await expect(pocFrame.locator("#cvStatus .text")).toHaveText("Hazır", {
    timeout: 120_000,
  });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Dosya yükle veya sürükle/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(EDITOR_FIXTURE);

  await expect(
    page
      .getByText(
        /Tasarım yüklendi|Bıçak hazır|kontur hesaplan|editor-bot\.png/i
      )
      .first()
  ).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Boyut", exact: true }).click();
  await page.getByRole("button", { name: "Bıçak", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Özel kesim" }).first()
  ).toBeVisible({ timeout: 15_000 });

  if (await cookieAccept.isVisible().catch(() => false)) {
    await cookieAccept.click();
  }

  await page.getByRole("button", { name: "Pim asistanını aç" }).click();
  const pimSheet = page.getByRole("dialog", { name: "Pim asistanı" });
  await expect(pimSheet).toBeVisible();
  await expect(pimSheet.getByRole("textbox", { name: "Pim komutu" })).toBeVisible();
});
