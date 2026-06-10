/**
 * Editör sağlamlık: hata mesajları parent banner'da görünür olmalı.
 * /editor giriş gerektirir — customer storageState (setup project).
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OVER_LIMIT_BYTES = 35 * 1024 * 1024;

function writeOversizePng(filePath: string, sizeBytes: number) {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const padding = Buffer.alloc(Math.max(0, sizeBytes - header.length), 0);
  fs.writeFileSync(filePath, Buffer.concat([header, padding]));
}

async function openEditor(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("pim_editor_onboarded", "1");
  });

  await page.goto("/editor", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 10_000 });

  const cookieAccept = page.getByRole("button", { name: "Hepsini kabul et" });
  if (await cookieAccept.isVisible().catch(() => false)) {
    await cookieAccept.click();
  }

  await expect(page.getByRole("tab", { name: "Görsel" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Görsel yükle — bıçak otomatik netleşir")
  ).toBeVisible({ timeout: 45_000 });
}

test("Editor: bozuk PDF yükleme — hata banner'da görünür", async ({ page }) => {
  test.setTimeout(90_000);
  await openEditor(page);

  const brokenPdfPath = path.join(os.tmpdir(), `pim-broken-${Date.now()}.pdf`);
  fs.writeFileSync(brokenPdfPath, "%PDF-1.4\n% not a real pdf\n%%EOF\n");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Dosya yükle veya sürükle/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(brokenPdfPath);

  await expect(
    page.getByText(/PDF açılamadı|açılamadı/i).first()
  ).toBeVisible({ timeout: 30_000 });

  fs.unlinkSync(brokenPdfPath);
});

test("Editor: 35MB PNG — dosya limit mesajı görünür", async ({ page }) => {
  test.setTimeout(90_000);
  await openEditor(page);

  const bigPngPath = path.join(os.tmpdir(), `pim-35mb-${Date.now()}.png`);
  writeOversizePng(bigPngPath, OVER_LIMIT_BYTES);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Dosya yükle veya sürükle/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(bigPngPath);

  await expect(
    page.getByText(/Dosyan çok büyük.*30 MB altına sıkıştırıp tekrar dene/i).first()
  ).toBeVisible({ timeout: 15_000 });

  fs.unlinkSync(bigPngPath);
});
