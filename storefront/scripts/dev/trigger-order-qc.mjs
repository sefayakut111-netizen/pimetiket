#!/usr/bin/env node
/**
 * Uploaded durumundaki siparisler icin QC pipeline tetikler.
 * repair-stuck-ai-files.mjs sonrasi kullan.
 *
 *   node scripts/dev/trigger-order-qc.mjs ORDER_ID [ORDER_ID...]
 *   node scripts/dev/trigger-order-qc.mjs --uploaded-recent
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const { createClient } = await import("@supabase/supabase-js");
const { runOrderDesignQC } = await import("../../src/lib/agents/run-order-qc.ts");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let orderIds = args.filter((a) => !a.startsWith("--"));

if (args.includes("--uploaded-recent")) {
  const { data } = await admin
    .from("design_files")
    .select("order_id")
    .eq("status", "uploaded")
    .neq("status", "superseded");
  orderIds = [...new Set((data ?? []).map((r) => r.order_id))];
}

if (orderIds.length === 0) {
  console.error("Kullanim: node scripts/dev/trigger-order-qc.mjs ORDER_ID ...");
  console.error("       veya: node scripts/dev/trigger-order-qc.mjs --uploaded-recent");
  process.exit(1);
}

console.log(`QC tetikleniyor: ${orderIds.length} siparis\n`);

for (const orderId of orderIds) {
  process.stdout.write(`${orderId} … `);
  try {
    const result = await runOrderDesignQC(admin, orderId);
    console.log(result.ok ? "OK" : `HATA: ${result.error ?? "unknown"}`);
  } catch (err) {
    console.log(`HATA: ${err instanceof Error ? err.message : err}`);
  }
}

console.log("\nBitti.");
