#!/usr/bin/env node
/**
 * .env.local → Vercel (pimetiket-storefront): GA4/GSC env'leri.
 * Önkoşul: npx vercel link --project pimetiket-storefront
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function runVercel(args) {
  const r = spawnSync("npx", ["vercel@latest", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

if (!existsSync(envPath)) {
  console.error("❌ .env.local yok");
  process.exit(1);
}

const env = parseEnvFile(readFileSync(envPath, "utf8"));
const KEYS = [
  "GA4_PROPERTY_ID",
  "GA4_SA_CLIENT_EMAIL",
  "GA4_SA_PRIVATE_KEY",
  "GSC_SITE_URL",
];

for (const key of KEYS) {
  if (!env[key]?.trim()) {
    console.error(`❌ .env.local'da ${key} eksik`);
    process.exit(1);
  }
}

let ok = 0;
let fail = 0;

for (const key of KEYS) {
  const val = env[key];
  const sensitive = key === "GA4_SA_PRIVATE_KEY";
  const extra = sensitive ? ["--sensitive"] : [];

  // Tek komut: production + preview + development (Vercel docs pattern)
  console.log(`→ ${key} (production, preview, development)`);
  let r = runVercel([
    "env",
    "add",
    key,
    "production",
    "preview",
    "development",
    "--yes",
    "--value",
    val,
    ...extra,
  ]);

  if (!r.ok && /already exists/i.test(r.out)) {
    r = runVercel([
      "env",
      "add",
      key,
      "production",
      "preview",
      "development",
      "--yes",
      "--force",
      "--value",
      val,
      ...extra,
    ]);
  }

  if (!r.ok) {
    // Fallback: scope başına
    for (const scope of ["production", "preview", "development"]) {
      console.log(`  fallback → ${scope}`);
      let s = runVercel([
        "env",
        "add",
        key,
        scope,
        "--yes",
        "--value",
        val,
        ...extra,
        ...(scope === "preview" ? ["main"] : []),
      ]);
      if (!s.ok && /already exists/i.test(s.out)) {
        s = runVercel([
          "env",
          "add",
          key,
          scope,
          "--yes",
          "--force",
          "--value",
          val,
          ...extra,
          ...(scope === "preview" ? ["main"] : []),
        ]);
      }
      if (s.ok) ok++;
      else {
        console.error(s.out.trim());
        fail++;
      }
    }
  } else {
    ok += 3;
  }
}

console.log(`\n✅ işlenen: ~${ok}, hata: ${fail}`);
console.log("Doğrula: npx vercel env ls | findstr GA4");
process.exit(fail > 0 ? 1 : 0);
