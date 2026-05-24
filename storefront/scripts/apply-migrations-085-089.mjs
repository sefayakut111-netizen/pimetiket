#!/usr/bin/env node
/**
 * Migration 085–089 — Supabase Management API ile sıralı apply.
 *
 * Gereksinimler:
 *   SUPABASE_ACCESS_TOKEN  — Dashboard → Account → Access Tokens
 *   SUPABASE_PROJECT_REF   — ucmpwxnoaqjpzhijnxtp (default)
 *
 * Kullanım:
 *   node scripts/apply-migrations-085-089.mjs
 *   node scripts/apply-migrations-085-089.mjs --dry-run
 *
 * Alternatif: Dashboard SQL Editor — dosyaları sırayla yapıştır.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

const FILES = [
  "085_security_patches.sql",
  "086_partner_contract_alignment.sql",
  "087_customer_audit_actions.sql",
  "088_auth_user_email_lookup.sql",
  "089_fason_token_hash.sql",
];

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
  if (!TOKEN && !DRY_RUN) {
    console.error(
      "SUPABASE_ACCESS_TOKEN gerekli. Dry-run için: --dry-run\n" +
        "Alternatif: Dashboard SQL Editor ile dosyaları sırayla çalıştır."
    );
    process.exit(1);
  }

  for (const file of FILES) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf8");
    console.log(`\n→ ${file} (${sql.length} bytes)`);
    if (DRY_RUN) {
      console.log("  [dry-run] atlandı");
      continue;
    }
    await applySql(file, sql);
    console.log("  ✓ apply OK");
  }

  console.log("\nSonraki adım:");
  console.log("  npm run supabase:types");
  console.log("  npx tsc --noEmit");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
