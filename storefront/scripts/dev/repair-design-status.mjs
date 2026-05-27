#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const oid = process.argv[2];
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: items } = await admin
  .from("order_items")
  .select("id")
  .eq("order_id", oid);
const itemId = items?.[0]?.id;

const { data: all } = await admin
  .from("design_files")
  .select("id, original_name, version, status")
  .eq("order_id", oid)
  .eq("order_item_id", itemId)
  .order("version");

for (const row of all ?? []) {
  if (row.status === "superseded") {
    await admin.from("design_files").update({ status: "qc_passed" }).eq("id", row.id);
  } else if (row.status === "analyzing") {
    await admin.from("design_files").update({ status: "qc_passed" }).eq("id", row.id);
  }
}

const { data: after } = await admin
  .from("design_files")
  .select("id, original_name, version, status")
  .eq("order_id", oid)
  .eq("order_item_id", itemId)
  .neq("status", "superseded")
  .order("version");

console.log("active:", after);
