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
if (!oid) {
  console.error("Usage: node scripts/debug-single-order.mjs <orderId>");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: order } = await admin.from("orders").select("id, status, created_at").eq("id", oid).single();
console.log("order:", order);

const { data: items } = await admin.from("order_items").select("id, meta").eq("order_id", oid);
for (const it of items ?? []) {
  console.log("\nitem meta:", JSON.stringify(it.meta, null, 2));
}

const { data: dfs } = await admin.from("design_files").select("id, original_name, status, order_item_id").eq("order_id", oid);
console.log("\ndesign_files:", dfs);

const { data: qc } = await admin.from("design_quality_checks").select("verdict, score, error, model, findings").eq("order_id", oid);
console.log("\nQC:", JSON.stringify(qc, null, 2));

const { data: cuts } = await admin.from("cutline_designs").select("id, order_item_id, design_file_id, status").eq("order_id", oid);
console.log("\ncutlines:", cuts);

const { data: ev } = await admin
  .from("order_events")
  .select("event_type, status_after, summary, created_at")
  .eq("order_id", oid)
  .order("created_at", { ascending: false })
  .limit(15);
console.log("\nevents:", ev);
