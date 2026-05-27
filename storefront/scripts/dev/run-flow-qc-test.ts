#!/usr/bin/env node
/**
 * ADIM 3/5 — Takılı sipariş için QC + cutline pipeline'ını doğrudan çalıştır.
 * npx tsx scripts/run-flow-qc-test.ts [orderId]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname ?? ".", "../..");
for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const orderId = process.argv[2];
if (!orderId) {
  console.error("Usage: npx tsx scripts/run-flow-qc-test.ts <orderId>");
  process.exit(1);
}

const { createAdminClient } = await import("../../src/lib/supabase/admin");
const { runOrderDesignQC } = await import("../../src/lib/agents/run-order-qc");

console.log("[flow-test] START orderId:", orderId);
const admin = createAdminClient();

const { data: before } = await admin
  .from("orders")
  .select("status")
  .eq("id", orderId)
  .single();
console.log("[flow-test] status before:", before?.status);

const result = await runOrderDesignQC(admin, orderId);
console.log("[flow-test] QC result:", result);

const { data: after } = await admin
  .from("orders")
  .select("status")
  .eq("id", orderId)
  .single();
console.log("[flow-test] status after:", after?.status);

const { data: cutlines } = await admin
  .from("cutline_designs")
  .select("id, status")
  .eq("order_id", orderId);
console.log("[flow-test] cutlines:", cutlines?.length ?? 0);
