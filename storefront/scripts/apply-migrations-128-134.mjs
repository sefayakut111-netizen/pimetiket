#!/usr/bin/env node
/**
 * Apply migrations 128-134 via Supabase Management API.
 * Token: .env.agent SUPABASE_ACCESS_TOKEN
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

function loadToken() {
  const env = readFileSync(join(root, ".env.agent"), "utf8");
  const m = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
  if (!m?.[1]?.trim()) throw new Error(".env.agent SUPABASE_ACCESS_TOKEN missing");
  return m[1].trim();
}

const TOKEN = loadToken();
const REF = "ucmpwxnoaqjpzhijnxtp";
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

const MIGRATIONS = [
  "128_admin_role_permissions_rls",
  "129_partner_create_admin_guard",
  "130_fn_apply_coupon_admin",
  "131_proof_sla_proof_uploaded_at",
  "132_fason_token_max_use",
  "133_fn_auto_advance_search_path",
  "134_pricing_live_view",
];

const STORAGE_FIX = `
drop policy if exists "design_previews_auth_delete" on storage.objects;
drop policy if exists "design_previews_owner_delete_v2" on storage.objects;
create policy "design_previews_owner_delete_v2" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'design-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
`;

async function runQuery(label, sql) {
  process.stdout.write(`→ ${label} ... `);
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await res.text();
  if (!res.ok) {
    console.log(`FAIL (${res.status})`);
    console.log(txt);
    return { ok: false, text: txt };
  }
  let payload;
  try {
    payload = JSON.parse(txt);
  } catch {
    payload = null;
  }
  if (payload?.error) {
    console.log(`FAIL (body error)`);
    console.log(txt);
    return { ok: false, text: txt };
  }
  console.log("OK");
  return { ok: true, text: txt };
}

async function apply134() {
  const path = join(root, "supabase/migrations/134_pricing_live_view.sql");
  const full = readFileSync(path, "utf8");
  let r = await runQuery("134_pricing_live_view", full);
  if (r.ok) return true;

  const enumSql = `alter type public.audit_action add value if not exists 'admin.impersonate_partner';`;
  const viewSql = full
    .split("\n")
    .slice(3)
    .join("\n")
    .trim();
  r = await runQuery("134 (enum only)", enumSql);
  if (!r.ok) return false;
  r = await runQuery("134 (view+policy)", viewSql);
  return r.ok;
}

async function main() {
  for (const name of MIGRATIONS) {
    if (name === "134_pricing_live_view") {
      if (!(await apply134())) process.exit(1);
      continue;
    }
    const sql = readFileSync(
      join(root, "supabase/migrations", `${name}.sql`),
      "utf8"
    );
    const r = await runQuery(name, sql);
    if (!r.ok) process.exit(1);
  }

  const storage = await runQuery("storage design-previews DELETE policy", STORAGE_FIX);
  if (!storage.ok) {
    console.log("\n⚠ Storage policy: Dashboard UI gerekebilir (42501 normal)");
  }

  // Smoke checks
  const checks = [
    {
      label: "fn_apply_coupon_admin exists",
      sql: `select proname from pg_proc where proname = 'fn_apply_coupon_admin';`,
    },
    {
      label: "v_pricing_live exists",
      sql: `select table_name from information_schema.views where table_schema='public' and table_name='v_pricing_live';`,
    },
    {
      label: "admin_role_permissions RLS",
      sql: `select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='admin_role_permissions';`,
    },
  ];
  console.log("\n--- smoke ---");
  for (const c of checks) {
    const r = await runQuery(c.label, c.sql);
    if (r.ok && r.text) console.log("   ", r.text.slice(0, 200));
  }

  console.log("\n✅ Migrations 128-134 apply tamam.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
