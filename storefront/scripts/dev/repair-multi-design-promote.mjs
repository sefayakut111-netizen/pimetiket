#!/usr/bin/env node
/**
 * Unpromoted additionalDesigns temp upload'larını design_files'a taşır.
 * Kullanım: node scripts/repair-multi-design-promote.mjs [--dry-run] [orderId]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const filterOrderId = process.argv
  .slice(2)
  .find((a) => !a.startsWith("-") && !a.endsWith(".mjs"));

for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BUCKET = process.env.STORAGE_BUCKET ?? "design-files";

function collectTempIds(meta) {
  const ids = [];
  if (typeof meta?.designTempId === "string" && !meta.designTempId.startsWith("local-")) {
    ids.push(meta.designTempId);
  }
  for (const e of meta?.additionalDesigns ?? []) {
    if (e?.tempId && !e.tempId.startsWith("local-") && !ids.includes(e.tempId)) {
      ids.push(e.tempId);
    }
  }
  return ids;
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let itemsQuery = admin
  .from("order_items")
  .select("id, order_id, meta, product")
  .not("meta", "is", null);

if (filterOrderId) {
  itemsQuery = itemsQuery.eq("order_id", filterOrderId);
}

const { data: items, error } = await itemsQuery.limit(500);
if (error) {
  console.error(error);
  process.exit(1);
}

let promoted = 0;

for (const item of items ?? []) {
  const meta = item.meta ?? {};
  const tempIds = collectTempIds(meta);
  if (tempIds.length <= 1 && !(Number(meta.designCount) > 1)) continue;

  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", item.order_id)
    .maybeSingle();
  if (!order) continue;

  const { data: existingDfs } = await admin
    .from("design_files")
    .select("id, storage_path")
    .eq("order_item_id", item.id)
    .neq("status", "superseded");

  const promotedTempPaths = new Set(
    (existingDfs ?? []).map((d) => d.storage_path?.split("/").pop()?.split(".")[0])
  );

  for (const tempId of tempIds) {
    const { data: temp } = await admin
      .from("design_temp_uploads")
      .select("id, storage_path, original_name, size_bytes, mime_type, sha256, promoted_to")
      .eq("id", tempId)
      .maybeSingle();

    if (!temp) {
      console.log(`  SKIP ${item.order_id} temp ${tempId} — upload kaydı yok`);
      continue;
    }
    if (temp.promoted_to) continue;

    const fileName = temp.storage_path.split("/").pop();
    if (promotedTempPaths.has(fileName?.replace(/\.[^.]+$/, ""))) continue;

    console.log(
      `${DRY ? "[DRY]" : "PROMOTE"} order=${item.order_id} item=${item.id.slice(0, 8)} temp=${tempId} (${temp.original_name})`
    );

    if (DRY) continue;

    const newPath = `${item.order_id}/${fileName}`;
    const { error: moveErr } = await admin.storage
      .from(BUCKET)
      .move(temp.storage_path, newPath);

    if (moveErr) {
      const { error: copyErr } = await admin.storage
        .from(BUCKET)
        .copy(temp.storage_path, newPath);
      if (copyErr) {
        console.error(`  FAIL storage: ${moveErr.message} / ${copyErr.message}`);
        continue;
      }
    }

    const fileId = randomUUID();
    const { error: insertErr } = await admin.from("design_files").insert({
      id: fileId,
      order_id: item.order_id,
      user_id: order.user_id,
      order_item_id: item.id,
      storage_path: newPath,
      original_name: temp.original_name,
      size_bytes: temp.size_bytes,
      mime_type: temp.mime_type,
      sha256: temp.sha256,
      version: 1,
      status: "analyzing",
    });

    if (insertErr) {
      console.error(`  FAIL insert: ${insertErr.message}`);
      continue;
    }

    await admin
      .from("design_temp_uploads")
      .update({ promoted_to: fileId })
      .eq("id", temp.id);

    await admin.from("order_events").insert({
      order_id: item.order_id,
      event_type: "file_uploaded",
      status_after: null,
      actor_id: order.user_id,
      actor_role: "system",
      summary: `Tasarım dosyası bağlandı (repair): ${temp.original_name}`,
      detail: { fileId, orderItemId: item.id, repair: true },
    });

    promoted++;
  }
}

console.log(`\nBitti. Promoted: ${promoted}${DRY ? " (dry-run)" : ""}`);
if (promoted > 0 && !DRY) {
  console.log(
    "Not: Yeni tasarımlar için QC/cutline tetiklemek üzere ilgili siparişlerde /onay sayfasını açın veya scheduleOrderDesignQC çalıştırın."
  );
}
