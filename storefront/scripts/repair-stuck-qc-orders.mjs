#!/usr/bin/env node
/**
 * Takılı qc_pending siparişler için QC'yi yeniden çalıştır.
 * node scripts/repair-stuck-qc-orders.mjs [--dry-run]
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

// Dynamic import TS module via compiled path — use direct logic instead
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log("=== Takılı qc_pending siparişler ===\n");

const { data: stuck } = await admin
  .from("orders")
  .select("id, status, created_at")
  .eq("status", "qc_pending")
  .order("created_at", { ascending: false });

if (!stuck?.length) {
  console.log("Takılı sipariş yok.");
  process.exit(0);
}

for (const o of stuck) {
  const { count: fileCount } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", o.id);

  const { count: qcCount } = await admin
    .from("design_quality_checks")
    .select("id", { count: "exact", head: true })
    .eq("order_id", o.id);

  console.log(
    `${o.id} | files=${fileCount ?? 0} | qc_checks=${qcCount ?? 0} | created=${o.created_at?.slice(0, 19)}`
  );

  if (DRY) continue;

  if ((fileCount ?? 0) === 0) {
    console.log("  → skip (design_files yok)");
    continue;
  }

  if ((qcCount ?? 0) > 0) {
    // QC zaten çalışmış — sadece status güncelle
    const { data: checks } = await admin
      .from("design_quality_checks")
      .select("verdict")
      .eq("order_id", o.id);
    const verdicts = (checks ?? []).map((c) => c.verdict);
    const allGood =
      verdicts.length > 0 &&
      verdicts.every((v) => v === "iyi") &&
      !verdicts.some((v) => v === "kotu" || v === "error" || v === "normal");
    const nextStatus = allGood ? "proof_generating" : "human_review";
    const { error } = await admin
      .from("orders")
      .update({ status: nextStatus, qc_attempt_count: 1 })
      .eq("id", o.id);
    console.log(
      `  → status repair: ${nextStatus} (${error?.message ?? "OK"}) verdicts=${verdicts.join(",")}`
    );
  } else {
    console.log("  → QC hiç çalışmamış — admin-bypass-promote veya design-qc API ile tetikle");
  }
}

console.log("\nBitti.");
