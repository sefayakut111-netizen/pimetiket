#!/usr/bin/env node
/** Apply a single migration SQL file to prod via Supabase Management API. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath =
  process.argv[2] ??
  join(ROOT, "supabase/migrations/141_referral_percent_rules.sql");

const envAgent = Object.fromEntries(
  readFileSync(join(ROOT, ".env.agent"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);

const projectRef = "ucmpwxnoaqjpzhijnxtp";
const token = envAgent.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing in .env.agent");
  process.exit(1);
}

const sql = readFileSync(migrationPath, "utf8");
const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await res.text();
if (!res.ok) {
  console.error("Migration failed:", res.status, body);
  process.exit(1);
}
console.log("Migration applied:", migrationPath);
console.log(body.slice(0, 500));
