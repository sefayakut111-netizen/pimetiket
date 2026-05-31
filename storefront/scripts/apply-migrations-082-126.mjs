#!/usr/bin/env node
/**
 * Migration 082 + 126 — sticker sheet başlık + etiket_rulo malzeme adları.
 * Kullanım: node scripts/apply-migrations-082-126.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILES = [
  "082_sticker_sheet_rename.sql",
  "126_etiket_rulo_material_display.sql",
];

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
  if (DRY_RUN) {
    console.log(`[dry-run] would apply ${name} (${sql.length} chars)`);
    return;
  }
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${name} failed HTTP ${res.status}: ${body}`);
  }
  console.log(`OK applied ${name}`);
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN missing (.env.agent)");
    process.exit(1);
  }
  for (const file of FILES) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf8");
    await applySql(file, sql);
  }
  console.log("apply-migrations-082-126: done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
