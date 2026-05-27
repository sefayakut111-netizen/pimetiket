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

const oid = process.argv[2] ?? "260520263771";
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: events } = await admin
  .from("order_events")
  .select("event_type, summary, detail, created_at")
  .eq("order_id", oid)
  .order("created_at", { ascending: false })
  .limit(15);

for (const e of events ?? []) {
  console.log(e.created_at?.slice(0, 19), e.event_type, e.summary);
  if (e.detail) console.log("  detail:", JSON.stringify(e.detail).slice(0, 200));
}

const { data: order } = await admin.from("orders").select("status").eq("id", oid).single();
console.log("\nstatus:", order?.status);
