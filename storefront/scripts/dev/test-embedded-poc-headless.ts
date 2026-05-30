#!/usr/bin/env node
/**
 * POC use-embedded modunu headless doğrular (bounding-box üretmeden cutline kaydeder).
 * npx tsx scripts/dev/test-embedded-poc-headless.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const embeddedPath =
  "M 30 35 Q 100 10 170 35 L 170 85 Q 100 110 30 85 Z";

async function main() {
  const chromium = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    defaultViewport: { width: 1280, height: 900 },
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();

  const resultPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting cutline")), 30000);
    page.exposeFunction("__pimCutlineSaved", (s: string) => {
      clearTimeout(t);
      resolve(JSON.parse(s) as Record<string, unknown>);
    });
    page.exposeFunction("__pimCutlineFailed", (s: string) => {
      clearTimeout(t);
      reject(new Error(s));
    });
  });

  await page.evaluateOnNewDocument(() => {
    const orig = window.parent.postMessage.bind(window.parent);
    window.parent.postMessage = (
      msg: unknown,
      targetOrOptions?: string | WindowPostMessageOptions,
      transfer?: Transferable[]
    ) => {
      const d = msg as { type?: string };
      if (d?.type === "pim-cutline-saved") {
        (window as unknown as { __pimCutlineSaved?: (s: string) => void }).__pimCutlineSaved?.(
          JSON.stringify(msg)
        );
      } else if (
        d?.type === "pim-cutline-auto-failed" ||
        d?.type === "pim-poc-error"
      ) {
        (window as unknown as { __pimCutlineFailed?: (s: string) => void }).__pimCutlineFailed?.(
          JSON.stringify(msg)
        );
      }
      if (typeof targetOrOptions === "string") {
        orig(msg, targetOrOptions, transfer);
      } else {
        orig(msg, targetOrOptions);
      }
    };
  });

  const params = new URLSearchParams({
    embed: "1",
    designUrl: `${siteUrl}/test-fixtures/embedded-magenta-cutline.svg`,
    designName: "embedded-magenta-cutline.svg",
    designMime: "image/svg+xml",
    material: "paper",
    mode: "use-embedded",
    autoSave: "1",
    headless: "1",
    orderId: "test-order",
    itemId: "test-item",
    embeddedCutline: embeddedPath,
    embeddedSource: "magenta_spot_color",
  });

  await page.goto(`${siteUrl}/poc.html?${params.toString()}`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  const result = await resultPromise;
  await browser.close();

  const meta = result.meta as Record<string, unknown> | undefined;
  console.log(JSON.stringify(result, null, 2));

  if (meta?.cutline_source !== "file_embedded") {
    throw new Error(`expected cutline_source=file_embedded, got ${meta?.cutline_source}`);
  }
  if (meta?.mode !== "use-embedded") {
    throw new Error(`expected mode=use-embedded, got ${meta?.mode}`);
  }
  if (!String(result.svg ?? "").includes("data-pim-embedded")) {
    throw new Error("SVG missing data-pim-embedded marker");
  }
  console.log("OK: POC use-embedded headless test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
