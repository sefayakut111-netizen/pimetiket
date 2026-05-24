#!/usr/bin/env node
/**
 * Upload zinciri statik + opsiyonel canlı doğrulama.
 *
 * Kullanım:
 *   node scripts/verify-upload-chain.mjs           # statik (repo dosyaları)
 *   node scripts/verify-upload-chain.mjs --live    # production DB örnekleme (env gerekir)
 *
 * Gerekli env (--live): SUPABASE_ACCESS_TOKEN veya .env.agent içinde token;
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY alternatif.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LIVE = process.argv.includes("--live");

const REQUIRED_ROUTES = [
  "src/app/api/cart/upload-preview/route.ts",
  "src/app/api/design/upload-init/route.ts",
  "src/app/api/design/upload-init-r2/route.ts",
  "src/app/api/design/upload-complete/route.ts",
  "src/app/api/agents/design-qc/route.ts",
  "src/app/api/orders/[id]/proof/[itemId]/save-edit/route.ts",
];

const REQUIRED_LIBS = [
  "src/lib/storage/buckets.ts",
  "src/lib/storage/design-files.ts",
  "src/lib/storage/r2-client.ts",
];

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

console.log("=== Upload chain verification ===\n");

// 1) Route + lib dosyaları
for (const rel of [...REQUIRED_ROUTES, ...REQUIRED_LIBS]) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) fail(`Missing ${rel}`);
  else ok(`Found ${rel}`);
}

// 2) buckets.ts sabitleri
const bucketsSrc = readFileSync(
  join(ROOT, "src/lib/storage/buckets.ts"),
  "utf8"
);
const expectedBuckets = [
  "designs",
  "design-previews",
  "review-photos",
  "customer-cutlines",
];
for (const b of expectedBuckets) {
  if (!bucketsSrc.includes(b)) fail(`buckets.ts missing reference: ${b}`);
  else ok(`buckets.ts references ${b}`);
}

// 3) design-files limitleri
const designFilesSrc = readFileSync(
  join(ROOT, "src/lib/storage/design-files.ts"),
  "utf8"
);
if (!designFilesSrc.includes("30 * 1024 * 1024")) {
  fail("MAX_FILE_SIZE should be 30 MB");
} else ok("MAX_FILE_SIZE = 30 MB");
if (designFilesSrc.includes('"image/svg"')) {
  fail("SVG should not be in allowed mime types");
} else ok("SVG not in upload allowlist");
for (const ext of [".ai", ".psd", ".eps"]) {
  if (!designFilesSrc.includes(`"${ext}"`)) fail(`Missing extension ${ext}`);
  else ok(`Allowed extension ${ext}`);
}

// 4) AI QC signed URL süresi
const qcSrc = readFileSync(
  join(ROOT, "src/app/api/agents/design-qc/route.ts"),
  "utf8"
);
if (!qcSrc.includes("3600")) fail("design-qc should use 3600s signed URL");
else ok("AI QC signed URL TTL = 3600s");

// 5) R2 cutline path buckets.ts ile hizalı
const r2Src = readFileSync(join(ROOT, "src/lib/storage/r2-client.ts"), "utf8");
if (!r2Src.includes("r2CutlineSvgKey")) {
  fail("r2-client should delegate cutline path to buckets.ts");
} else ok("r2-client uses r2CutlineSvgKey from buckets.ts");

// 6) Dokümantasyon referansı
const docPath = join(ROOT, "docs/DOSYA-AKISI.md");
if (!existsSync(docPath)) fail("docs/DOSYA-AKISI.md missing");
else {
  const doc = readFileSync(docPath, "utf8");
  if (!doc.includes("buckets.ts")) fail("DOSYA-AKISI.md should link buckets.ts");
  else ok("DOSYA-AKISI.md links buckets.ts");
  if (!doc.includes("proof_generating")) {
    fail("DOSYA-AKISI.md diagram should include proof_generating");
  } else ok("DOSYA-AKISI.md includes proof_generating flow");
}

if (LIVE) {
  console.log("\n--- Live sampling (optional) ---");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      "SKIP live: set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
    );
  } else {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: files, error } = await admin
      .from("design_files")
      .select("id, storage_path, order_id")
      .like("storage_path", "designs/%")
      .limit(3);
    if (error) {
      fail(`design_files query: ${error.message}`);
    } else if (!files?.length) {
      console.warn("WARN: no design_files with designs/ prefix (empty DB?)");
    } else {
      ok(`Sample design_files paths: ${files.map((f) => f.storage_path).join(", ")}`);
    }
    const { data: cutlines } = await admin
      .from("cutline_designs")
      .select("svg_url")
      .not("svg_url", "is", null)
      .limit(3);
    if (cutlines?.length) {
      const allR2 = cutlines.every((c) =>
        String(c.svg_url).startsWith("customer-cutlines/")
      );
      if (allR2) ok("cutline_designs.svg_url uses customer-cutlines/ prefix");
      else fail("cutline_designs.svg_url prefix mismatch");
    } else {
      console.warn("WARN: no cutline_designs rows to sample");
    }
  }
}

console.log("\n=== Manual live checklist (operator) ===");
console.log("1. POST /api/design/upload-init → signed URL");
console.log("2. PUT file → Supabase designs/ bucket");
console.log("3. POST /api/design/upload-complete → design_files row");
console.log("4. runOrderDesignQC → design_quality_checks");
console.log("5. /onay → save-edit → cutline_designs + R2 customer-cutlines/");

if (process.exitCode) {
  console.error("\nVerification FAILED");
  process.exit(process.exitCode);
}
console.log("\nVerification PASSED");
