#!/usr/bin/env node
/**
 * Migration 185 — ai_usage_logs source CHECK genişlet
 * Kullanım: node scripts/apply-migrations-185.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILE = "185_ai_usage_sources_expand.sql";

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

async function querySql(sql) {
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
    throw new Error(`query failed (${res.status}): ${body.slice(0, 600)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function applySql(name, sql) {
  console.log(`Applying ${name}...`);
  await querySql(sql);
  console.log(`OK ${name}`);
}

async function verifyConstraint() {
  const rows = await querySql(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'ai_usage_logs'
      AND c.conname = 'ai_usage_logs_source_check';
  `);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("ai_usage_logs_source_check constraint missing");
  }
  const def = String(rows[0]?.def ?? "");
  if (!def.includes("proof_validate") || !def.includes("daily_summary")) {
    throw new Error(`constraint def unexpected: ${def.slice(0, 200)}`);
  }
  console.log("[verify] mig 185 ai_usage_logs_source_check OK");
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  const path = join(MIGRATIONS_DIR, FILE);
  const sql = readFileSync(path, "utf8");
  if (DRY_RUN) {
    console.log(`[dry-run] ${FILE} (${sql.length} chars)`);
    return;
  }
  await applySql(FILE, sql);
  console.log("Verify...");
  await verifyConstraint();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
