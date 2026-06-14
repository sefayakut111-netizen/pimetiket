#!/usr/bin/env node
/**
 * Migration 180 — apply + canlı obje doğrulama.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const MIGRATION_FILE = "180_order_transition_infrastructure.sql";

const REQUIRED_FUNCTIONS = [
  "fn_transition_order_status",
  "fn_with_advisory_lock",
  "fn_release_advisory_lock",
  "fn_is_valid_order_forward_transition",
];

const REQUIRED_INDEXES = [
  "order_events_idempotency_unique",
  "coupon_uses_coupon_user_unique",
  "cron_runs_one_running_per_name",
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
const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run");

async function querySql(sql: string) {
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

async function applyMigration() {
  const path = join(MIGRATIONS_DIR, MIGRATION_FILE);
  const sql = readFileSync(path, "utf8");
  console.log(`Applying ${MIGRATION_FILE}...`);
  await querySql(sql);
  console.log(`OK ${MIGRATION_FILE}`);
}

async function verifyObjects() {
  const fnRows = (await querySql(`
    SELECT p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'fn_transition_order_status',
        'fn_with_advisory_lock',
        'fn_release_advisory_lock',
        'fn_is_valid_order_forward_transition'
      ]);
  `)) as { name: string }[];

  const idxRows = (await querySql(`
    SELECT indexname AS name
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY(ARRAY[
        'order_events_idempotency_unique',
        'coupon_uses_coupon_user_unique',
        'cron_runs_one_running_per_name'
      ]);
  `)) as { name: string }[];

  const foundFns = new Set(fnRows.map((r) => r.name));
  const foundIdx = new Set(idxRows.map((r) => r.name));

  const missingFns = REQUIRED_FUNCTIONS.filter((f) => !foundFns.has(f));
  const missingIdx = REQUIRED_INDEXES.filter((i) => !foundIdx.has(i));

  if (missingFns.length > 0 || missingIdx.length > 0) {
    throw new Error(
      `Eksik: fn=[${missingFns.join(", ")}] idx=[${missingIdx.join(", ")}]`
    );
  }

  const colCheck = await querySql(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_events'
      AND column_name = 'idempotency_key';
  `);
  if (!Array.isArray(colCheck) || colCheck.length === 0) {
    throw new Error("order_events.idempotency_key kolonu yok");
  }

  console.log("[verify:faz1-infrastructure] OK — tüm objeler canlıda");
  console.log(`  functions: ${[...foundFns].join(", ")}`);
  console.log(`  indexes: ${[...foundIdx].join(", ")}`);
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  if (APPLY) {
    if (DRY_RUN) {
      console.log("[dry-run] migration apply atlandı");
    } else {
      await applyMigration();
    }
  }

  if (!DRY_RUN) {
    await verifyObjects();
  } else {
    console.log("[dry-run] verify atlandı");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
