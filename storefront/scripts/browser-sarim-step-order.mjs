import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function locked(page, id) {
  return page.locator(`#${id}`).getAttribute("aria-disabled");
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/etiket/yapilandir?form=rulo`, {
    waitUntil: "networkidle",
  });

  const domOrder = await page
    .locator('[id^="step-"]')
    .evaluateAll((els) => els.map((e) => e.id));
  console.log("DOM order:", domOrder.join(" -> "));
  const expected = [
    "step-1",
    "step-2",
    "step-7",
    "step-6",
    "step-8",
    "step-4",
    "step-5",
  ];
  if (JSON.stringify(domOrder) !== JSON.stringify(expected)) {
    throw new Error(`DOM order mismatch: ${domOrder.join(",")}`);
  }

  if ((await locked(page, "step-8")) !== "true") {
    throw new Error("step-8 should be locked initially");
  }
  if ((await locked(page, "step-4")) !== "true") {
    throw new Error("step-4 should be locked initially");
  }

  await page.locator("#step-1").getByRole("button").first().click();
  await page.locator("#step-2").getByRole("button").first().click();
  await page.waitForTimeout(300);

  if ((await locked(page, "step-6")) === "true") {
    throw new Error("step-6 should unlock after material+coating");
  }

  await page.locator("#step-6 button").filter({ hasText: "60" }).first().click();

  if ((await locked(page, "step-8")) === "true") {
    throw new Error("step-8 should unlock after size");
  }

  await page
    .locator("#step-8 button")
    .filter({ hasText: "1.000" })
    .first()
    .click();

  if ((await locked(page, "step-4")) === "true") {
    throw new Error("step-4 should unlock after qty");
  }
  if ((await locked(page, "step-5")) !== "true") {
    throw new Error("step-5 should stay locked until winding");
  }

  console.log("Browser lock chain OK");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
