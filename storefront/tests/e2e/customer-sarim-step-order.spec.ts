import { test, expect } from "@playwright/test";

test("rulo sarım adımları adet altında — DOM + kilit", async ({ page }) => {
  await page.goto("/etiket/yapilandir?form=rulo&shape=diecut", {
    waitUntil: "domcontentloaded",
  });

  const domOrder = await page.locator('[id^="step-"]').evaluateAll((els) =>
    els.map((e) => e.id)
  );
  expect(domOrder).toEqual([
    "step-1",
    "step-2",
    "step-7",
    "step-6",
    "step-8",
    "step-4",
    "step-5",
  ]);

  const isLocked = async (id: string) => {
    const section = page.locator(`#${id}`);
    return (await section.getByText("🔒").count()) > 0;
  };

  // URL ?shape= → unlockedSteps step-6 (boyut) açar; opsiyonel tasarım
  // atlanınca adet (8) de açık olabilir — bilinçli davranış.
  expect(await isLocked("step-4")).toBe(true);

  await page.locator("#step-1 button").first().click();
  await page.locator("#step-2 button").first().click();

  expect(await isLocked("step-6")).toBe(false);

  await page.locator("#step-6 button").filter({ hasText: "60" }).first().click();

  expect(await isLocked("step-4")).toBe(true);

  await page.locator("#step-8 button").filter({ hasText: "1.000" }).first().click();

  expect(await isLocked("step-4")).toBe(false);
  expect(await isLocked("step-5")).toBe(true);

  await page.locator("#step-4 button").first().click();

  expect(await isLocked("step-5")).toBe(false);
});
