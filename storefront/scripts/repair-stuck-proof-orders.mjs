#!/usr/bin/env node
/**
 * proof_generating ve human_review'da takılı siparişleri proof_pending'e taşır.
 * node scripts/repair-stuck-proof-orders.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

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

console.log("=== Takılı proof / human_review siparişler ===\n");

const { data: stuck } = await admin
  .from("orders")
  .select("id, status, created_at")
  .in("status", ["proof_generating", "human_review"])
  .order("created_at", { ascending: false });

if (!stuck?.length) {
  console.log("Takılı sipariş yok.");
  process.exit(0);
}

console.log(`Bulunan: ${stuck.length} sipariş\n`);

for (const o of stuck) {
  const { count: dfCount } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", o.id)
    .neq("status", "superseded");

  if (!dfCount) {
    console.log(`  SKIP ${o.id} (${o.status}) — design_files yok`);
    continue;
  }

  console.log(
    `  ${DRY ? "[DRY]" : "FIX"} ${o.id}: ${o.status} → proof_pending (${dfCount} design)`
  );

  if (!DRY) {
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", o.id)
      .in("status", ["proof_generating", "human_review"]);

    await admin.from("order_events").insert({
      order_id: o.id,
      event_type: "proof_repair_unblock",
      status_after: "proof_pending",
      actor_role: "system",
      summary: "Takılı sipariş proof_pending'e taşındı (repair script)",
      detail: { previous_status: o.status, design_files: dfCount },
    });
  }
}

console.log("\nBitti.");
