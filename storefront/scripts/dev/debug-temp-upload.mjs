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

const tid = process.argv[2] || "35a501ad-cad4-49e7-a0d0-d76f4100492e";
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data } = await admin
  .from("design_temp_uploads")
  .select("id, original_name, promoted_to, storage_path, user_id")
  .eq("id", tid)
  .maybeSingle();
console.log("temp upload:", data);

const { data: recent } = await admin
  .from("orders")
  .select("id, status, created_at")
  .in("status", ["proof_pending", "proof_generating", "human_review"])
  .order("created_at", { ascending: false })
  .limit(8);
console.log("\nrecent stuck orders:", recent);
