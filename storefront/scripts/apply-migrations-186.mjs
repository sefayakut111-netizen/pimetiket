#!/usr/bin/env node
/**
 * Migration 186 — mail_suppressions cat='all' backfill
 * Kullanım: node scripts/apply-migrations-186.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILE = "186_backfill_unsubscribe_all_blocked_categories.sql";

const PRE_COUNT_SQL = `
  SELECT count(*)::int AS cnt FROM public.mail_suppressions
  WHERE suppression_type IN ('unsubscribe_marketing','unsubscribe_blog')
    AND blocked_categories IS NULL
    AND reason LIKE 'user_unsubscribe%';
`;

const VERIFY_SQL = `
  SELECT count(*)::int AS remaining_null FROM public.mail_suppressions
  WHERE suppression_type IN ('unsubscribe_marketing','unsubscribe_blog')
    AND blocked_categories IS NULL
    AND reason LIKE 'user_unsubscribe%';
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

async function preCount() {
  const rows = await querySql(PRE_COUNT_SQL);
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  console.log(`[pre-count] rows matching backfill predicate: ${cnt}`);
  return cnt;
}

async function applySql(name, sql) {
  console.log(`Applying ${name}...`);
  await querySql(sql);
  console.log(`OK ${name}`);
}

async function verifyBackfill() {
  const rows = await querySql(VERIFY_SQL);
  const remaining = Number(rows?.[0]?.remaining_null ?? 0);
  if (remaining !== 0) {
    throw new Error(
      `backfill incomplete: ${remaining} user_unsubscribe rows still have NULL blocked_categories`
    );
  }
  console.log("[verify] mig 186 backfill OK (remaining_null=0)");
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  const path = join(MIGRATIONS_DIR, FILE);
  const sql = readFileSync(path, "utf8");

  await preCount();

  if (DRY_RUN) {
    console.log(`[dry-run] ${FILE} (${sql.length} chars) — UPDATE skipped`);
    return;
  }

  await applySql(FILE, sql);
  console.log("Verify...");
  await verifyBackfill();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
