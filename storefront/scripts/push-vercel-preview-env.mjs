#!/usr/bin/env node
/** Preview scope için 3 env (stdin — branch prompt bypass) */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let val = t.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq)] = val;
  }
  return out;
}

const env = parseEnvFile(readFileSync(resolve(root, ".env.local"), "utf8"));
const KEYS = ["GA4_PROPERTY_ID", "GA4_SA_CLIENT_EMAIL", "GSC_SITE_URL"];

for (const key of KEYS) {
  const val = env[key];
  console.log(`→ ${key} @ preview`);
  let r = spawnSync(
    "npx",
    ["vercel@latest", "env", "add", key, "preview", "main", "--yes"],
    { cwd: root, input: val, encoding: "utf8", shell: true }
  );
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    if (/already exists/i.test(out)) {
      r = spawnSync(
        "npx",
        ["vercel@latest", "env", "add", key, "preview", "main", "--yes", "--force"],
        { cwd: root, input: val, encoding: "utf8", shell: true }
      );
    }
    if (r.status !== 0) {
      console.error(out || r.stderr);
      process.exit(1);
    }
    console.log("  (güncellendi)");
  } else {
    console.log("  OK");
  }
}
