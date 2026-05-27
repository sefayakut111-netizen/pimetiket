#!/usr/bin/env node
/**
 * Takili "analyzing" design_files kayitlarini uploaded'a ceker ve QC tetikler.
 *
 *   node scripts/dev/repair-stuck-ai-files.mjs [--dry-run]
 *   node scripts/dev/repair-stuck-ai-files.mjs --confirm
 *
 * Calistirmadan once kullaniciya sor — prod verisini etkiler.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DRY = process.argv.includes("--dry-run");
const CONFIRM = process.argv.includes("--confirm");

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

const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

console.log("=== Takili analyzing design_files ===\n");
console.log(`Kesim: created_at < ${cutoff}\n`);

const { data: stuck, error } = await admin
  .from("design_files")
  .select("id, order_id, status, created_at, original_name")
  .eq("status", "analyzing")
  .lt("created_at", cutoff)
  .order("created_at", { ascending: true });

if (error) {
  console.error("Sorgu hatasi:", error.message);
  process.exit(1);
}

if (!stuck?.length) {
  console.log("Takili dosya yok.");
  process.exit(0);
}

console.log(`${stuck.length} dosya bulundu:\n`);
for (const f of stuck) {
  console.log(
    `  ${f.id.slice(0, 8)}… | order=${f.order_id} | ${f.original_name} | ${f.created_at?.slice(0, 19)}`
  );
}

if (DRY) {
  console.log("\n--dry-run: degisiklik yapilmadi.");
  process.exit(0);
}

if (!CONFIRM) {
  console.log("\nUygulamak icin: node scripts/dev/repair-stuck-ai-files.mjs --confirm");
  process.exit(0);
}

const orderIds = new Set();
let repaired = 0;

for (const f of stuck) {
  const { error: updErr } = await admin
    .from("design_files")
    .update({ status: "uploaded" })
    .eq("id", f.id);
  if (updErr) {
    console.error(`  HATA ${f.id}:`, updErr.message);
    continue;
  }
  repaired += 1;
  orderIds.add(f.order_id);
}

console.log(`\n${repaired} dosya uploaded yapildi.`);
console.log(`${orderIds.size} siparis icin QC tetiklenmeli (admin panel butonu veya API).`);
console.log("\nQC tetigi icin: POST /api/admin/designs/repair-stuck (panel) veya run-order-qc script.");
console.log("Bitti.");
