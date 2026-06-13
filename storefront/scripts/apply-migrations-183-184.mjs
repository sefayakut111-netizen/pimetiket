#!/usr/bin/env node
/**
 * Migrations 183 + 184 — apply + verify
 * Kullanım: node scripts/apply-migrations-183-184.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILES = [
  "183_reprint_coupon_idempotency.sql",
  "184_rbac_self_escalation_guard.sql",
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

async function verifyObjects() {
  const idxRows = await querySql(`
    SELECT indexname AS name FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'coupons_reprint_source_unique';
  `);
  if (!Array.isArray(idxRows) || idxRows.length === 0) {
    throw new Error("coupons_reprint_source_unique index missing");
  }

  const triggerRows = await querySql(`
    SELECT tgname AS name FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles'
      AND tgname = 'trg_guard_admin_role_escalation' AND NOT t.tgisinternal;
  `);
  if (!Array.isArray(triggerRows) || triggerRows.length === 0) {
    throw new Error("trg_guard_admin_role_escalation trigger missing");
  }

  const fnRows = await querySql(`
    SELECT p.proname AS name FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_guard_admin_role_escalation';
  `);
  if (!Array.isArray(fnRows) || fnRows.length === 0) {
    throw new Error("fn_guard_admin_role_escalation function missing");
  }

  console.log("[verify] mig 183 index + mig 184 trigger/fn OK");
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  for (const file of FILES) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf8");
    if (DRY_RUN) {
      console.log(`[dry-run] ${file} (${sql.length} chars)`);
      continue;
    }
    await applySql(file, sql);
  }

  if (!DRY_RUN) {
    console.log("Verify...");
    await verifyObjects();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
