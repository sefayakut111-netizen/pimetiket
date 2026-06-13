#!/usr/bin/env node
/**
 * Migration 181 — anon/authenticated RPC EXECUTE sertleştirme
 * Kullanım: node scripts/apply-migrations-181.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILES = ["181_anon_rpc_execute_hardening.sql"];

const PROBE_FUNCTIONS = [
  "fn_transition_order_status",
  "fn_with_advisory_lock",
  "fn_release_advisory_lock",
  "fn_is_valid_order_forward_transition",
  "fn_is_valid_order_bulk_transition",
  "fn_validate_fason_token",
  "fn_complete_referral",
  "fn_apply_referral_code",
  "fn_refresh_fason_scores",
  "fn_suggest_fason_partner",
  "fn_enqueue_mail",
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

async function verifyPrivileges() {
  const names = PROBE_FUNCTIONS.map((n) => `'${n}'`).join(",");
  const rows = await querySql(`
    SELECT
      p.proname AS name,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (${names})
    ORDER BY p.proname;
  `);

  if (!Array.isArray(rows)) {
    throw new Error("Privilege probe beklenmeyen yanıt");
  }

  const svcMustExec = new Set([
    "fn_transition_order_status",
    "fn_with_advisory_lock",
    "fn_release_advisory_lock",
    "fn_validate_fason_token",
    "fn_complete_referral",
    "fn_apply_referral_code",
    "fn_refresh_fason_scores",
    "fn_suggest_fason_partner",
    "fn_enqueue_mail",
  ]);

  const failures = [];
  for (const row of rows) {
    const anon = row.anon_exec === true || row.anon_exec === "t";
    const auth = row.auth_exec === true || row.auth_exec === "t";
    const svc = row.svc_exec === true || row.svc_exec === "t";

    if (anon || auth) {
      failures.push(
        `${row.name}: anon_exec=${anon} auth_exec=${auth} (beklenen false)`
      );
    }
    if (svcMustExec.has(row.name) && !svc) {
      failures.push(`${row.name}: svc_exec=false (beklenen true)`);
    }

    console.log(
      `  ${row.name}: anon=${anon} auth=${auth} svc=${svc}`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Privilege probe FAILED:\n${failures.join("\n")}`);
  }

  console.log("[verify] 11 RPC — anon/auth EXECUTE kapalı, service_role korunmuş");
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
      console.log(`[dry-run] ${file} (${sql.length} chars) — yazma YAPILMADI`);
      continue;
    }
    await applySql(file, sql);
  }

  if (!DRY_RUN) {
    console.log("Privilege probe...");
    await verifyPrivileges();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
