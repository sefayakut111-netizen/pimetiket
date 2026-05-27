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

const oid = process.argv[2] || "260520262357";
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: cut } = await admin
  .from("cutline_designs")
  .select("id, preview_png_url, design_file_id, status, svg_url")
  .eq("order_id", oid);
console.log("cutlines:", cut);

const { data: dfs } = await admin
  .from("design_files")
  .select("id, original_name, status, order_item_id, version, storage_path")
  .eq("order_id", oid);
console.log("design_files:", dfs);
