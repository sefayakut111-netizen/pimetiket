#!/usr/bin/env node
/** Apply 090–092 only (RBAC + fason status) — .env.agent token gerekli */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const ENV_AGENT = join(__dirname, "..", ".env.agent");

const FILES = [
  "090_rbac_extended_modules.sql",
  "091_assign_admin_roles.sql",
  "092_fason_assign_modern_status.sql",
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
    throw new Error(`${name} failed (${res.status}): ${body.slice(0, 800)}`);
  }
}

async function main() {
  if (!TOKEN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli");
    process.exit(1);
  }
  for (const file of FILES) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`→ ${file}`);
    await applySql(file, sql);
    console.log("  ✓ OK");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
