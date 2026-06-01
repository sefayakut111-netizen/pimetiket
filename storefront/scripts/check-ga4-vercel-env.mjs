#!/usr/bin/env node
/**
 * GA4 Data API — Vercel Production env durumu.
 *
 * Usage: node scripts/check-ga4-vercel-env.mjs
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const REQUIRED = [
  "GA4_PROPERTY_ID",
  "GA4_SA_CLIENT_EMAIL",
  "GA4_SA_PRIVATE_KEY",
];
const FALLBACK = ["GSC_SA_CLIENT_EMAIL", "GSC_SA_PRIVATE_KEY"];

function listEnv(environment) {
  const out = execSync(`npx vercel env ls ${environment}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const names = new Set();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s+([A-Z0-9_]+)\s+/);
    if (m) names.add(m[1]);
  }
  return names;
}

const prod = listEnv("production");
const measurement = prod.has("NEXT_PUBLIC_GA4_MEASUREMENT_ID");

console.log("=== GA4 Vercel Production env ===\n");
console.log(
  `NEXT_PUBLIC_GA4_MEASUREMENT_ID: ${measurement ? "✓ tanımlı" : "✗ eksik"}`
);

const missing = [];
for (const name of REQUIRED) {
  const ok = prod.has(name);
  console.log(`${name}: ${ok ? "✓ tanımlı" : "✗ eksik"}`);
  if (!ok && name !== "GA4_SA_CLIENT_EMAIL" && name !== "GA4_SA_PRIVATE_KEY") {
    missing.push(name);
  }
}

const saEmail = prod.has("GA4_SA_CLIENT_EMAIL") || prod.has("GSC_SA_CLIENT_EMAIL");
const saKey = prod.has("GA4_SA_PRIVATE_KEY") || prod.has("GSC_SA_PRIVATE_KEY");
console.log(
  `Service account email: ${saEmail ? "✓ (GA4_SA_* veya GSC_SA_*)" : "✗ eksik"}`
);
console.log(
  `Service account key: ${saKey ? "✓ (GA4_SA_* veya GSC_SA_*)" : "✗ eksik"}`
);

if (!saEmail) missing.push("GA4_SA_CLIENT_EMAIL (veya GSC_SA_CLIENT_EMAIL)");
if (!saKey) missing.push("GA4_SA_PRIVATE_KEY (veya GSC_SA_PRIVATE_KEY)");

console.log("\n=== Özet ===");
if (missing.length === 0) {
  console.log("Data API env hazır. Redeploy sonrası /admin/trafik çalışmalı.");
  process.exit(0);
}

console.log("Eksik:", missing.join(", "));
console.log(
  "\nKurulum: node scripts/setup-ga4-vercel-env.mjs --sa-json <path-to-key.json>"
);
process.exit(1);
