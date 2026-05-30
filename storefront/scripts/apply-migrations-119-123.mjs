#!/usr/bin/env node
/**
 * Migration 119 + 123 — RBAC finance preset + operatör CRM notu.
 * Kullanım: node scripts/apply-migrations-119-123.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILES = [
  "119_rbac_ui_presets.sql",
  "123_operator_customer_notes.sql",
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
    throw new Error(`${name} failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return body;
}

async function main() {
  if (!TOKEN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  // Mig 119: enum value ayrı transaction'da commit edilmeli (Postgres 55P04)
  const mig119Path = join(MIGRATIONS_DIR, "119_rbac_ui_presets.sql");
  const mig119Full = readFileSync(mig119Path, "utf8");
  const mig119Rest = mig119Full.replace(
    /ALTER TYPE public\.admin_role_v2 ADD VALUE IF NOT EXISTS 'finance';\s*/i,
    ""
  );

  const steps = [
    { name: "119 enum finance", sql: "ALTER TYPE public.admin_role_v2 ADD VALUE IF NOT EXISTS 'finance';" },
    { name: "119_rbac_ui_presets.sql (rest)", sql: mig119Rest },
    ...FILES.filter((f) => f !== "119_rbac_ui_presets.sql").map((file) => ({
      name: file,
      sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
    })),
  ];

  for (const step of steps) {
    console.log(`Applying ${step.name}...`);
    if (DRY_RUN) {
      console.log(`[dry-run] ${step.name} (${step.sql.length} chars)`);
      continue;
    }
    await applySql(step.name, step.sql);
    console.log(`OK ${step.name}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
