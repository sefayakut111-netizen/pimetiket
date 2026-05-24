#!/usr/bin/env node
/**
 * R2 hot path smoke test — HeadObject + signed URL GET 200.
 *
 * Kullanım:
 *   node scripts/verify-r2.mjs
 *   node scripts/verify-r2.mjs --fetch   # signed URL'e GET dene
 *
 * Gerekli env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_ENDPOINT (EU: https://<account>.eu.r2.cloudflarestorage.com), R2_BUCKET
 */

import {
  uploadToR2,
  getR2ObjectInfo,
  getSignedDownloadUrl,
  deleteFromR2,
  getR2Config,
} from "../src/lib/storage/r2-client.ts";

const WITH_FETCH = process.argv.includes("--fetch");
const PROBE_KEY = `_health/verify-r2-${Date.now()}.txt`;
const PROBE_BODY = `verify-r2-${new Date().toISOString()}`;

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

console.log("=== R2 verify ===\n");

const config = getR2Config();
console.log("Config:", JSON.stringify(config, null, 2));

if (!config.hasCredentials) {
  fail("R2 credentials eksik (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  process.exit(1);
}

const upload = await uploadToR2({
  key: PROBE_KEY,
  body: PROBE_BODY,
  contentType: "text/plain",
});
if (!upload.success) {
  fail(`uploadToR2: ${upload.error}`);
  process.exit(1);
}
ok(`upload hot path (${upload.dryRun ? "dryRun unexpected" : "real"})`);

const info = await getR2ObjectInfo(PROBE_KEY);
if (!info.exists) {
  fail("HeadObject: probe key bulunamadı");
} else {
  ok(`HeadObject size=${info.size}`);
}

const signedUrl = await getSignedDownloadUrl(PROBE_KEY, 300);
if (!signedUrl.includes("http")) {
  fail(`Signed URL geçersiz: ${signedUrl}`);
} else {
  ok("Signed download URL üretildi");
}

if (WITH_FETCH) {
  const resp = await fetch(signedUrl);
  if (!resp.ok) {
    fail(`Signed URL GET ${resp.status}`);
  } else {
    const text = await resp.text();
    if (text !== PROBE_BODY) {
      fail("Signed URL içerik uyuşmazlığı");
    } else {
      ok("Signed URL GET 200 + içerik doğru");
    }
  }
}

await deleteFromR2(PROBE_KEY);
ok("Probe key silindi");

if (config.archiveDryRun) {
  console.log(
    "\nNOTE: R2_ARCHIVE_DRY_RUN=true — cold archive cron simülasyon modunda."
  );
  console.log("Production arşiv için: R2_ARCHIVE_DRY_RUN=false");
} else {
  ok("R2_ARCHIVE_DRY_RUN=false (cold archive aktif)");
}

console.log("\n=== R2 verify tamamlandı ===");
