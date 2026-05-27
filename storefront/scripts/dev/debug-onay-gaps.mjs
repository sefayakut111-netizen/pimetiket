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

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Multi-design orders: meta.designCount > actual design_files count
const { data: items } = await admin
  .from("order_items")
  .select("id, order_id, meta")
  .not("meta", "is", null)
  .order("created_at", { ascending: false })
  .limit(200);

const gaps = [];
for (const it of items ?? []) {
  const meta = it.meta;
  const dc = Number(meta?.designCount) || 0;
  if (dc <= 1) continue;
  const { count } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_item_id", it.id)
    .neq("status", "superseded");
  if ((count ?? 0) < dc) {
    gaps.push({
      order_id: it.order_id,
      item_id: it.id,
      designCount: dc,
      design_files: count,
      additionalInMeta: meta?.additionalDesigns?.length ?? 0,
    });
  }
}
console.log("multi-design gaps (designCount > design_files):", gaps.length);
console.log(JSON.stringify(gaps.slice(0, 10), null, 2));

// Cutlines without preview_png
const { data: noPreview } = await admin
  .from("cutline_designs")
  .select("order_id, order_item_id, id, status")
  .is("preview_png_url", null)
  .neq("status", "superseded")
  .limit(10);
console.log("\ncutlines missing preview_png:", noPreview?.length ?? 0, noPreview);

// design_files stuck analyzing > 1h with QC done
const { data: stuckAnalyzing } = await admin
  .from("design_files")
  .select("id, order_id, status, created_at")
  .eq("status", "analyzing")
  .limit(15);
console.log("\ndesign_files still analyzing:", stuckAnalyzing?.length);
