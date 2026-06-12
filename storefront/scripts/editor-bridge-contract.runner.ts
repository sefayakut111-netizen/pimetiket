/**
 * poc ↔ EditorShell köprü sözleşmesi — 0-path anında sinyal (10sn watchdog yok).
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import {
  humanizeCutlineFailReason,
  humanizeLoadFailReason,
} from "../src/lib/editor/poc-error-messages";

const POC_QUERY =
  "embed=1&standalone=1&editorShell=1&orderWidthMm=50&orderHeightMm=50&bridgeTest=zero-path";

type BridgeMsg = {
  type?: string;
  reason?: string;
  error?: string;
  retryable?: boolean;
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function startPublicStaticServer(): Promise<{ baseUrl: string; close: () => void }> {
  const publicDir = join(process.cwd(), "public");
  const server = createServer((req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
    const rel = urlPath === "/" ? "/poc.html" : urlPath;
    const filePath = join(publicDir, rel.replace(/^\//, "").replace(/\.\./g, ""));
    try {
      const data = readFileSync(filePath);
      const ext = filePath.split(".").pop()?.toLowerCase();
      const type =
        ext === "html"
          ? "text/html; charset=utf-8"
          : ext === "js"
            ? "application/javascript"
            : ext === "css"
              ? "text/css"
              : "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port =
        typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

async function runBridgeContractTest() {
  const pocSource = readFileSync(join(process.cwd(), "public/poc.html"), "utf8");
  assert(
    pocSource.includes("pimRunBridgeTestHook"),
    "poc.html bridge test hook eksik"
  );
  assert(
    pocSource.includes("pimReportCutlineAutoFailed"),
    "poc.html cutline auto-failed helper eksik"
  );
  assert(
    pocSource.includes("pim-poc-load-failed"),
    "poc.html load-failed sinyali eksik"
  );
  assert(
    humanizeCutlineFailReason("0-path").includes("bıçak yolu"),
    "humanizeCutlineFailReason(0-path)"
  );
  assert(
    humanizeLoadFailReason("opencv_not_ready").includes("otomatik"),
    "humanizeLoadFailReason(opencv_not_ready)"
  );

  const { baseUrl, close } = await startPublicStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const started = Date.now();

  await page.setContent(
    `<!doctype html><html><head><script>
      window.__bridgeMsgs = [];
      window.addEventListener("message", function(e) {
        if (e.data && e.data.type) window.__bridgeMsgs.push(e.data);
      });
    </script></head><body style="margin:0"><iframe id="poc" style="width:100%;height:600px;border:0" src="${baseUrl}/poc.html?${POC_QUERY}"></iframe></body></html>`
  );

  let failedMsg: BridgeMsg | null = null;
  for (let i = 0; i < 80; i++) {
    const messages = (await page.evaluate(
      () => (window as unknown as { __bridgeMsgs?: BridgeMsg[] }).__bridgeMsgs ?? []
    )) as BridgeMsg[];
    failedMsg =
      messages.find((m) => m.type === "pim-cutline-auto-failed") ?? null;
    if (failedMsg) break;
    await page.waitForTimeout(100);
  }

  await browser.close();
  close();

  const elapsed = Date.now() - started;
  assert(failedMsg !== null, "pim-cutline-auto-failed mesajı alınamadı");
  const hit = failedMsg as BridgeMsg;
  const reason = String(hit.reason ?? hit.error ?? "");
  assert(reason.includes("0-path"), `beklenen reason 0-path, got: ${reason}`);
  assert(elapsed < 8000, `yanıt yavaş: ${elapsed}ms (hedef <8s)`);

  console.log("[editor-bridge-contract] OK");
  console.log(`  pim-cutline-auto-failed in ${elapsed}ms`);
  console.log(`  UI mesajı: ${humanizeCutlineFailReason(reason)}`);
}

runBridgeContractTest().catch((err) => {
  console.error("[editor-bridge-contract] FAIL", err);
  process.exit(1);
});
