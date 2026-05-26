#!/usr/bin/env node
/**
 * ADIM 1-2: Sipariş + design_files akış diagnostiği
 * node scripts/debug-flow-status.mjs [--orderId=XXX]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  for (const f of [".env.local", ".env.agent"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const orderIdArg = process.argv.find((a) => a.startsWith("--orderId="));
const filterOrderId = orderIdArg?.split("=")[1];

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== ADIM 1 — Son 10 sipariş status ===\n");

let orderQuery = admin
  .from("orders")
  .select("id, status, user_id, created_at, updated_at")
  .order("created_at", { ascending: false })
  .limit(10);

if (filterOrderId) {
  orderQuery = admin
    .from("orders")
    .select("id, status, user_id, created_at, updated_at")
    .eq("id", filterOrderId);
}

const { data: orders, error: ordersErr } = await orderQuery;
if (ordersErr) {
  console.error("orders query failed:", ordersErr.message);
  process.exit(1);
}

const stuckStatuses = new Set([
  "paid",
  "awaiting_upload",
  "qc_pending",
  "proof_generating",
  "human_review",
  "operator_review",
]);

for (const o of orders ?? []) {
  const stuck = stuckStatuses.has(o.status) ? " ⚠ TAKILI?" : "";
  console.log(
    `${o.id} | status=${o.status}${stuck} | created=${o.created_at?.slice(0, 19)}`
  );
}

const orderIds = (orders ?? []).map((o) => o.id);
if (orderIds.length === 0) {
  console.log("\nSipariş bulunamadı.");
  process.exit(0);
}

console.log("\n=== ADIM 2 — design_files + order_items.meta ===\n");

const { data: items } = await admin
  .from("order_items")
  .select("id, order_id, title, meta")
  .in("order_id", orderIds);

for (const o of orders ?? []) {
  const oItems = (items ?? []).filter((i) => i.order_id === o.id);
  console.log(`\n--- Order ${o.id} (${o.status}) ---`);
  for (const it of oItems) {
    const meta = it.meta ?? {};
    console.log(
      `  item ${it.id.slice(0, 8)}… designTempId=${meta.designTempId ?? "YOK"} designCount=${meta.designCount ?? "?"}`
    );
  }
}

const { data: files } = await admin
  .from("design_files")
  .select("id, order_id, order_item_id, status, original_name, created_at")
  .in("order_id", orderIds)
  .order("created_at", { ascending: false });

console.log("\n--- design_files ---");
if (!files?.length) {
  console.log("  (hiç design_files yok — promote çalışmamış olabilir)");
} else {
  for (const f of files) {
    console.log(
      `  ${f.order_id} | ${f.original_name} | status=${f.status} | item=${f.order_item_id?.slice(0, 8) ?? "?"}…`
    );
  }
}

const { data: cutlines } = await admin
  .from("cutline_designs")
  .select("id, order_id, order_item_id, status, created_at")
  .in("order_id", orderIds);

console.log("\n--- cutline_designs ---");
if (!cutlines?.length) {
  console.log("  (hiç cutline yok)");
} else {
  for (const c of cutlines) {
    console.log(
      `  ${c.order_id} | status=${c.status} | item=${c.order_item_id?.slice(0, 8) ?? "?"}…`
    );
  }
}

const { data: events } = await admin
  .from("order_events")
  .select("order_id, event_type, status_after, summary, created_at")
  .in("order_id", orderIds)
  .order("created_at", { ascending: false })
  .limit(30);

console.log("\n--- Son order_events (max 30) ---");
for (const e of events ?? []) {
  console.log(
    `  ${e.order_id} | ${e.event_type} → ${e.status_after ?? "-"} | ${e.summary?.slice(0, 60) ?? ""}`
  );
}

console.log("\n=== Özet ===");
const statusCounts = {};
for (const o of orders ?? []) {
  statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
}
console.log("Status dağılımı:", statusCounts);

const ordersNoFiles = (orders ?? []).filter(
  (o) =>
    !["awaiting_upload", "cancelled"].includes(o.status) &&
    !(files ?? []).some((f) => f.order_id === o.id)
);
if (ordersNoFiles.length) {
  console.log(
    "\n🔴 KIRIK NOKTA A adayı (design_files boş):",
    ordersNoFiles.map((o) => `${o.id}(${o.status})`).join(", ")
  );
}

const proofGenNoCutline = (orders ?? []).filter(
  (o) =>
    o.status === "proof_generating" &&
    !(cutlines ?? []).some((c) => c.order_id === o.id)
);
if (proofGenNoCutline.length) {
  console.log(
    "\n🔴 KIRIK NOKTA E adayı (proof_generating, cutline yok):",
    proofGenNoCutline.map((o) => o.id).join(", ")
  );
}

const qcPassedStuck = (orders ?? []).filter((o) => o.status === "qc_pending");
if (qcPassedStuck.length) {
  console.log(
    "\n🟡 qc_pending takılı:",
    qcPassedStuck.map((o) => o.id).join(", ")
  );
}
