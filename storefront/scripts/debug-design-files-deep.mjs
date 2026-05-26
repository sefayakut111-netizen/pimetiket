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

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const oid = process.argv[2] ?? "260520261875";

const { data: all, count } = await admin
  .from("design_files")
  .select("*", { count: "exact" })
  .eq("order_id", oid);
console.log("design_files for", oid, "count=", count, all);

const { data: recent } = await admin
  .from("design_files")
  .select("id, order_id, status, storage_path, created_at")
  .order("created_at", { ascending: false })
  .limit(10);
console.log("\nrecent design_files globally:", recent);

const { data: ev } = await admin
  .from("order_events")
  .select("detail")
  .eq("order_id", oid)
  .eq("event_type", "file_uploaded")
  .limit(1);
console.log("\nfile_uploaded detail:", ev?.[0]?.detail);

const fileId = ev?.[0]?.detail?.fileId;
if (fileId) {
  const { data: byId, error } = await admin
    .from("design_files")
    .select("*")
    .eq("id", fileId);
  console.log("by fileId:", byId, error?.message);
}

const { data: temps } = await admin
  .from("design_temp_uploads")
  .select("id, promoted_to, storage_path")
  .eq("user_id", (await admin.from("orders").select("user_id").eq("id", oid).single()).data?.user_id)
  .order("created_at", { ascending: false })
  .limit(5);
console.log("\nrecent temp uploads:", temps);

const { data: qc } = await admin
  .from("design_quality_checks")
  .select("id, order_id, verdict, created_at")
  .eq("order_id", oid);
console.log("\nQC checks for order:", qc);
