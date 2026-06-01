#!/usr/bin/env node
/**
 * Migration 138 — sticker cut_multipliers
 * Kullanım: node scripts/apply-migration-138.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

function loadEnvAgent() {
  if (!existsSync(ENV_AGENT)) return;
  for (const rawLine of readFileSync(ENV_AGENT, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvAgent();

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ?? "ucmpwxnoaqjpzhijnxtp";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

async function applySql(name, sql) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${name} failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return body;
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  const file = "138_sticker_cut_multipliers.sql";
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  console.log(`Applying ${file}...`);
  if (DRY_RUN) {
    console.log(`[dry-run] ${file} (${sql.length} chars)`);
    return;
  }

  await applySql(file, sql);
  console.log(`OK ${file}`);

  const verify = await applySql(
    "verify",
    "SELECT live_config->'cut_multipliers' AS cut_mult FROM pricing_config WHERE scope='sticker'"
  );
  console.log("Verify:", verify);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
