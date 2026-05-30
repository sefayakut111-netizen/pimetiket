#!/usr/bin/env node
/**
 * Prod DB doğrulama: Mig 113, 114, 119
 * node scripts/verify-migrations-113-114-119.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const FN_SIG =
  "public.fn_create_order(text, uuid, numeric, numeric, numeric, jsonb, jsonb, jsonb, date, jsonb)";

const queries = [
  {
    name: "Mig 119 — admin_role_v2 enum (finance var mı?)",
    sql: `SELECT unnest(enum_range(NULL::admin_role_v2))::text AS role ORDER BY 1;`,
  },
  {
    name: "Mig 114 — authenticated fn_create_order EXECUTE",
    sql: `SELECT has_function_privilege('authenticated', '${FN_SIG}', 'EXECUTE') AS authenticated_can_execute;`,
  },
  {
    name: "Mig 114 — service_role fn_create_order EXECUTE",
    sql: `SELECT has_function_privilege('service_role', '${FN_SIG}', 'EXECUTE') AS service_role_can_execute;`,
  },
  {
    name: "Mig 113 — operations + finans (satır olmamalı)",
    sql: `SELECT role, module, can_view, can_create, can_update, can_delete, can_approve FROM admin_role_permissions WHERE role = 'operations' AND module = 'finans';`,
  },
  {
    name: "Mig 119/123 — operations + customers",
    sql: `SELECT role, module, can_view, can_create, can_update, can_delete FROM admin_role_permissions WHERE role = 'operations' AND module = 'customers';`,
  },
];

async function runQuery(sql) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function main() {
  if (!TOKEN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  for (const q of queries) {
    console.log(`\n=== ${q.name} ===`);
    try {
      const rows = await runQuery(q.sql);
      console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
      console.error(String(err));
    }
  }
}

main();
