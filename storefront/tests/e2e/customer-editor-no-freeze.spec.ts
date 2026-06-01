/**
 * Editör no-freeze + console-error denetimi.
 * /editor giriş gerektirir — customer storageState (setup project).
 */
import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import path from "node:path";

const EDITOR_FIXTURE = path.resolve("tests/fixtures/editor-bot.png");

function attachErrorTracking(page: Page, errors: string[]) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      text.includes("Download the React DevTools") ||
      text.includes("[Fast Refresh]") ||
      text.includes("DevTools") ||
      text.includes("Failed to fetch") ||
      text.includes("net::ERR_ABORTED")
    ) {
      return;
    }
    errors.push(`[console.error] ${text}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
}

test("Editor: yükleme + bıçak etkileşimi donmaz", async ({ page }) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    localStorage.setItem("pim_editor_onboarded", "1");
  });

  const errors: string[] = [];
  attachErrorTracking(page, errors);

  await page.goto("/editor", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 10_000 });

  const cookieAccept = page.getByRole("button", { name: "Hepsini kabul et" });
  if (await cookieAccept.isVisible().catch(() => false)) {
    await cookieAccept.click();
  }

  await expect(page.getByRole("tab", { name: "Görsel" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('iframe[title="Bıçak editörü"]').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Görsel yükle — bıçak otomatik netleşir")
  ).toBeVisible({ timeout: 45_000 });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: /Dosya yükle veya sürükle/i })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(EDITOR_FIXTURE);

  const uploaded = await page
    .getByText("editor-bot.png")
    .isVisible({ timeout: 20_000 })
    .catch(() => false);

  await page.getByRole("tab", { name: "Bıçak" }).click();

  if (uploaded) {
    const offsetSlider = page.getByRole("slider").first();
    await expect(offsetSlider).toBeEnabled({ timeout: 30_000 });
    await offsetSlider.fill("1.5");
  } else {
    await page.getByRole("button", { name: "Yakınlaştır" }).click();
    await page.getByRole("button", { name: "Uzaklaştır" }).click();
    await page.getByRole("tab", { name: "Boyut" }).click();
  }

  const evalResult = await Promise.race([
    page.evaluate(() => 1 + 1),
    new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error("page.evaluate timeout — freeze?")), 5000)
    ),
  ]);
  expect(evalResult).toBe(2);

  const pocFrame = page.frameLocator('iframe[title="Bıçak editörü"]').first();
  await expect(pocFrame.locator("body")).toBeAttached({ timeout: 10_000 });

  expect(errors, `Editör runtime errors:\n${errors.join("\n")}`).toEqual([]);
});
