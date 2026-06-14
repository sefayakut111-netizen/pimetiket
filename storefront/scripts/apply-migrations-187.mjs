#!/usr/bin/env node
/**
 * Migration 187 — shipment event dedup index (assignment_id dahil)
 * Kullanım: node scripts/apply-migrations-187.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILE = "187_shipment_event_dedupe_key.sql";

const VERIFY_SQL = `
  SELECT indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = 'uniq_shipment_event_dedupe';
`;

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

async function verifyIndex() {
  const rows = await querySql(VERIFY_SQL);
  const def = String(rows?.[0]?.indexdef ?? "");
  if (
    !def.includes("assignment_id") ||
    !def.includes("order_id") ||
    !def.includes("status") ||
    !def.includes("event_time")
  ) {
    throw new Error(
      `uniq_shipment_event_dedupe index mismatch: ${def.slice(0, 200)}`
    );
  }
  console.log("[verify] mig 187 index OK:", def);
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  const path = join(MIGRATIONS_DIR, FILE);
  const sql = readFileSync(path, "utf8");

  if (DRY_RUN) {
    console.log(`[dry-run] ${FILE} (${sql.length} chars) — skipped`);
    return;
  }

  await applySql(FILE, sql);
  console.log("Verify...");
  await verifyIndex();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
