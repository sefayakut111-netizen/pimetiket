/**
 * ED-7 — editör algı katmanı: akıllı boyut önerisi + mm etiketleri.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

function pocFrame(page: Page) {
  return page.frameLocator('iframe[title="Bıçak editörü"]').first();
}

async function openEditor(page: Page) {
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

  const iframe = page.locator('iframe[title="Bıçak editörü"]').first();
  await expect(iframe).toBeVisible({ timeout: 60_000 });
  await expect(pocFrame(page).locator("#canvas")).toBeAttached({
    timeout: 90_000,
  });

  await expect(pocFrame(page).locator("#cvStatus .text")).toHaveText("Hazır", {
    timeout: 120_000,
  });

  const uploadBtn = page.getByRole("button", {
    name: /Dosya yükle veya sürükle/i,
  });
  await expect(uploadBtn).toBeEnabled({ timeout: 60_000 });
}

/** 10×20 px PNG — uzun kenar 50 mm → 25×50 mm önerisi */
async function createAspectPngBuffer(
  page: Page,
  width: number,
  height: number
): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return [];
      ctx.fillStyle = "#e85d4c";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(2, 2, width - 4, height - 4);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return [];
      const ab = await blob.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    },
    { width, height }
  );
  return Buffer.from(bytes);
}

test("Editor: akıllı boyut toast + mm etiketleri (10×20 → 25×50 mm)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openEditor(page);

  const pngBuffer = await createAspectPngBuffer(page, 10, 20);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Dosya yükle veya sürükle/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "editor-perception-10x20.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });

  await expect(
    page.getByText(/Boyutu dosyana uydurduk:\s*25×50\s*mm/i).first()
  ).toBeVisible({ timeout: 60_000 });

  await expect(
    page.getByText(/Tasarım yüklendi|Bıçak hazır|kontur hesaplan/i).first()
  ).toBeVisible({ timeout: 90_000 });

  await expect(page.getByTestId("editor-mm-labels")).toHaveText("25×50", {
    timeout: 60_000,
  });

  await page.getByRole("tab", { name: "Boyut" }).click();
  await expect(page.getByLabel("Genişlik (mm)")).toHaveValue("25");
  await expect(page.getByLabel("Yükseklik (mm)")).toHaveValue("50");
});
