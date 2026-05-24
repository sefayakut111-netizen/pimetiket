#!/usr/bin/env node
/**
 * Manifest + cold restore URL smoke test.
 *
 * Kullanım:
 *   node scripts/verify-manifest-restore.mjs
 *   node scripts/verify-manifest-restore.mjs --order <orderId>
 *   node scripts/verify-manifest-restore.mjs --design <designFileId> --user <userId>
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const orderIdx = args.indexOf("--order");
const designIdx = args.indexOf("--design");
const userIdx = args.indexOf("--user");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

console.log("=== Manifest + restore smoke ===\n");

const manifestRoute = join(
  ROOT,
  "src/app/api/admin/print-job/[orderId]/manifest/route.ts"
);
const restoreRoute = join(
  ROOT,
  "src/app/api/customer/design-files/[id]/restore-url/route.ts"
);

if (!existsSync(manifestRoute)) fail("manifest route missing");
else ok("manifest route exists");
if (!existsSync(restoreRoute)) fail("restore-url route missing");
else ok("restore-url route exists");

if (orderIdx === -1 && designIdx === -1) {
  console.log("\nStatik doğrulama tamam. Canlı test için:");
  console.log("  node scripts/verify-manifest-restore.mjs --order <orderId>");
  console.log(
    "  node scripts/verify-manifest-restore.mjs --design <id> --user <userId>"
  );
  process.exit(process.exitCode ?? 0);
}

const siteUrl = process.env.SITE_URL ?? "https://pimetiket.com";

if (orderIdx >= 0) {
  const orderId = args[orderIdx + 1];
  if (!orderId) {
    fail("--order requires orderId");
    process.exit(1);
  }

  const cronSecret = process.env.CRON_SECRET;
  const headers = cronSecret
    ? { Authorization: `Bearer ${cronSecret}` }
    : {};

  const url = `${siteUrl}/api/admin/print-job/${orderId}/manifest`;
  console.log(`GET ${url}`);
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    fail(`manifest HTTP ${resp.status}`);
  } else {
    const json = await resp.json();
    ok(`manifest JSON alındı (${Object.keys(json).length} top-level keys)`);
    const urls = collectUrls(json);
    let checked = 0;
    for (const u of urls.slice(0, 20)) {
      if (!u.startsWith("http")) continue;
      const head = await fetch(u, { method: "HEAD" }).catch(() => null);
      if (head?.ok) {
        ok(`HEAD 200: ${u.slice(0, 80)}...`);
        checked++;
      } else {
        const get = await fetch(u).catch(() => null);
        if (get?.ok) {
          ok(`GET 200: ${u.slice(0, 80)}...`);
          checked++;
        } else {
          fail(`URL erişilemedi: ${u.slice(0, 100)}`);
        }
      }
    }
    console.log(`URL smoke: ${checked}/${Math.min(urls.length, 20)} OK`);
  }
}

if (designIdx >= 0) {
  const designFileId = args[designIdx + 1];
  const userId = userIdx >= 0 ? args[userIdx + 1] : null;
  if (!designFileId || !userId) {
    fail("--design requires --user <requesterId>");
    process.exit(1);
  }

  const { getArchivedDesignFileUrl } = await import(
    "../src/lib/storage/restore-service.ts"
  );

  const result = await getArchivedDesignFileUrl({
    designFileId,
    requesterId: userId,
    requesterType: "admin",
    reason: "verify-manifest-restore smoke",
  });

  if ("error" in result) {
    fail(`restore URL: ${result.error}`);
  } else {
    ok(`restore signed URL: ${result.url.slice(0, 80)}...`);
    const resp = await fetch(result.url, { method: "HEAD" });
    if (resp.ok) ok("restore URL HEAD 200");
    else {
      const get = await fetch(result.url);
      if (get.ok) ok("restore URL GET 200");
      else fail(`restore URL HTTP ${resp.status}`);
    }
  }
}

function collectUrls(obj, out = []) {
  if (typeof obj === "string" && obj.startsWith("http")) {
    out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectUrls(v, out);
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) collectUrls(v, out);
  }
  return out;
}

console.log("\n=== Smoke tamamlandı ===");
