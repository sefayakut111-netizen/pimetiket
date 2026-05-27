#!/usr/bin/env node
/** Test orders update with qc_attempt_count */
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

const oid = "260520261875";

const { error: err1 } = await admin
  .from("orders")
  .update({ status: "human_review", qc_attempt_count: 1 })
  .eq("id", oid);
console.log("[test] update with qc_attempt_count error:", err1?.message ?? "OK");

const { data: d1 } = await admin.from("orders").select("status").eq("id", oid).single();
console.log("[test] status:", d1?.status);

// revert for test
if (!err1) {
  await admin.from("orders").update({ status: "qc_pending" }).eq("id", oid);
}

const { error: err2 } = await admin
  .from("orders")
  .update({ status: "human_review" })
  .eq("id", oid);
console.log("[test] update status-only error:", err2?.message ?? "OK");

const { data: d2 } = await admin.from("orders").select("status").eq("id", oid).single();
console.log("[test] status after status-only:", d2?.status);
