import { test, expect } from "@playwright/test";

test("sticker malzeme→laminasyon→boyut — DOM + kilit + boş input", async ({
  page,
}) => {
  await page.goto("/sticker/yapilandir?cut=diecut&shape=square", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("#step-3")).toBeVisible({ timeout: 20_000 });

  const domOrder = await page.locator('[id^="step-"]').evaluateAll((els) =>
    els.map((e) => e.id)
  );
  expect(domOrder).toEqual(["step-3", "step-4", "step-7", "step-5", "step-6"]);

  const isLocked = async (id: string) => {
    const section = page.locator(`#${id}`);
    return (await section.getByText("🔒").count()) > 0;
  };

  const sizeInput = page.locator("#step-5 input[type='number']").first();

  // Başlangıç: boyut kilitli, input boş (75×75 görünmemeli).
  expect(await isLocked("step-5")).toBe(true);
  await expect(sizeInput).toHaveValue("");

  // Sadece malzeme — boyut hâlâ kilitli + input boş.
  await page.locator("#step-3 button").first().click();
  expect(await isLocked("step-5")).toBe(true);
  await expect(sizeInput).toHaveValue("");

  // Laminasyon — boyut açılır, varsayılan kenar dolu.
  await page.locator("#step-4 button").first().click();
  expect(await isLocked("step-5")).toBe(false);
  await expect(sizeInput).not.toHaveValue("");
});
