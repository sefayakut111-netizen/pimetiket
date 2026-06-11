#!/usr/bin/env node
/**
 * Migration 179 — integration_secrets.
 * Kullanım: node scripts/apply-migrations-179.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILES = ["179_integration_secrets.sql"];

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

if (!TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

for (const file of FILES) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  console.log(`[apply-migrations-179] ${file} (${sql.length} bytes)`);
  if (dryRun) continue;

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

  if (!res.ok) {
    const body = await res.text();
    console.error(`[apply-migrations-179] FAILED ${file}:`, res.status, body);
    process.exit(1);
  }
  console.log(`[apply-migrations-179] OK ${file}`);
}

console.log("[apply-migrations-179] done");
