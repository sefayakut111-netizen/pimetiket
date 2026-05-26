import "server-only";

interface CutlineResult {
  svg: string;
  preview_png_base64: string | null;
  meta: Record<string, unknown>;
}

/**
 * Headless Puppeteer ile POC'u çalıştırıp bıçak üretir.
 * poc.html?autoSave=1&headless=1 → postMessage "pim-cutline-saved" bekler.
 */
export async function generateCutlineHeadless(args: {
  designUrl: string;
  designName: string;
  designMime: string;
  material: string;
  orderId: string;
  itemId: string;
  siteUrl: string;
}): Promise<CutlineResult | null> {
  const chromium = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");

  let browser: Awaited<ReturnType<typeof puppeteer.default.launch>> | null =
    null;
  try {
    browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    const cutlinePromise = new Promise<CutlineResult | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 90000);

      void page.exposeFunction("__pimCutlineSaved", (data: string) => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data) as {
            svg?: string;
            preview_png_base64?: string | null;
            meta?: Record<string, unknown>;
          };
          if (parsed.svg && parsed.meta) {
            resolve({
              svg: parsed.svg,
              preview_png_base64: parsed.preview_png_base64 ?? null,
              meta: parsed.meta,
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });

      void page.exposeFunction("__pimCutlineFailed", (_err: string) => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    await page.evaluateOnNewDocument(() => {
      const origPostMessage = window.parent.postMessage.bind(window.parent);
      window.parent.postMessage = (
        msg: unknown,
        targetOrOptions?: string | WindowPostMessageOptions,
        transfer?: Transferable[]
      ) => {
        const d = msg as { type?: string } | undefined;
        if (d?.type === "pim-cutline-saved") {
          (
            window as unknown as { __pimCutlineSaved?: (s: string) => void }
          ).__pimCutlineSaved?.(JSON.stringify(msg));
        } else if (
          d?.type === "pim-cutline-auto-failed" ||
          d?.type === "pim-poc-error"
        ) {
          (
            window as unknown as { __pimCutlineFailed?: (s: string) => void }
          ).__pimCutlineFailed?.(JSON.stringify(msg));
        }
        if (typeof targetOrOptions === "string") {
          origPostMessage(msg, targetOrOptions, transfer);
        } else {
          origPostMessage(msg, targetOrOptions);
        }
      };
    });

    const params = new URLSearchParams({
      embed: "1",
      designUrl: args.designUrl,
      designName: args.designName,
      designMime: args.designMime,
      material: args.material,
      mode: "contour",
      autoSave: "1",
      headless: "1",
      orderId: args.orderId,
      itemId: args.itemId,
    });

    await page.goto(`${args.siteUrl}/poc.html?${params.toString()}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("[cutline-headless] poc loaded, waiting for cutline…", args.orderId);
    const result = await cutlinePromise;
    if (!result) {
      console.error("[cutline-headless] timeout or empty result", args.orderId, args.itemId);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cutline-headless] error:", msg, args.orderId, args.itemId);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
