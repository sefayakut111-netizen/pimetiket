/**
 * Köprü sözleşmesi: 0-path → anında pim-cutline-auto-failed (10sn bıçak watchdog yok).
 */
import { test, expect } from "@playwright/test";

const POC_SRC =
  "/poc.html?embed=1&standalone=1&editorShell=1&orderWidthMm=50&orderHeightMm=50&bridgeTest=zero-path";

test("Bridge: 0-path anında hata sinyali — watchdog beklemez", async ({ page }) => {
  test.setTimeout(30_000);

  await page.setContent(
    `<!doctype html><html><head><script>
      window.__bridgeMsgs = [];
      window.addEventListener("message", function(e) {
        if (e.data && e.data.type) window.__bridgeMsgs.push(e.data);
      });
    </script></head><body><iframe src="${POC_SRC}" style="width:800px;height:600px;border:0"></iframe></body></html>`
  );

  await expect
    .poll(
      async () =>
        (await page.evaluate(
          () =>
            (window as unknown as { __bridgeMsgs?: Array<{ type?: string }> }).__bridgeMsgs?.find(
              (m) => m.type === "pim-cutline-auto-failed"
            ) ?? null
        )) ?? null,
      { timeout: 8_000 }
    )
    .not.toBeNull();

  const hit = (await page.evaluate(() => {
    const msgs = (window as unknown as {
      __bridgeMsgs?: Array<{ type?: string; reason?: string; error?: string }>;
    }).__bridgeMsgs ?? [];
    return msgs.find((m) => m.type === "pim-cutline-auto-failed");
  })) as { reason?: string; error?: string } | undefined;
  const reason = String(hit?.reason ?? hit?.error ?? "");
  expect(reason).toContain("0-path");
});
