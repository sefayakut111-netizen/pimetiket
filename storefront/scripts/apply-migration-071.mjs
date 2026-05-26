#!/usr/bin/env node
/**
 * Migration 071 — qc_attempt_count kolonu (QC status update için gerekli)
 * node scripts/apply-migration-071.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_AGENT = join(__dirname, "..", ".env.agent");
const SQL_FILE = join(__dirname, "..", "supabase", "migrations", "071_qc_attempt_guard.sql");

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

if (!TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN missing (.env.agent)");
  process.exit(1);
}

const sql = readFileSync(SQL_FILE, "utf8");
console.log(`Applying 071_qc_attempt_guard.sql to ${PROJECT_REF}${DRY_RUN ? " (dry-run)" : ""}…`);

if (DRY_RUN) {
  console.log(sql.slice(0, 500));
  process.exit(0);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await res.text();
if (!res.ok) {
  console.error("FAIL:", res.status, body);
  process.exit(1);
}
console.log("OK: migration 071 applied");
