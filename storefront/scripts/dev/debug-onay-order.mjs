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

const oid = process.argv[2] || "260520265554";
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: order } = await admin
  .from("orders")
  .select("id, status, user_id")
  .eq("id", oid)
  .single();
console.log("order:", order);

const itemId = "488eff38-96f9-4fb0-986d-b531fd34bd25";
const cutlineId = "7e499c14-fe5c-4c81-92f6-9ca23188016a";
const dfId = "12001771-b6bc-4e7c-a710-789d25ca11c7";

const { data: cd } = await admin
  .from("cutline_designs")
  .select("preview_png_url")
  .eq("id", cutlineId)
  .single();
console.log("preview key:", cd?.preview_png_url);

// Simulate fn_proof_summary shape via RPC as service role won't work with auth.uid
// Instead query what RPC would return
const { data: df } = await admin
  .from("design_files")
  .select("id, original_name, mime_type, size_bytes, version, status")
  .eq("id", dfId)
  .single();

const { data: cutline } = await admin
  .from("cutline_designs")
  .select("*")
  .eq("design_file_id", dfId)
  .neq("status", "superseded")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

console.log("\nRPC-like designs[]:", {
  design_file_id: df?.id,
  file_name: df?.original_name,
  cutline_id: cutline?.id,
  cutline_preview: cutline?.preview_png_url,
  cutline_status: cutline?.status,
});

const { data: oi } = await admin
  .from("order_items")
  .select("proof_status, title, width, height")
  .eq("id", itemId)
  .single();
console.log("\nitem:", oi);
