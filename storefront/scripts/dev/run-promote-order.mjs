#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

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

const oid = process.argv[2];
const BUCKET = "designs";
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: order } = await admin.from("orders").select("user_id").eq("id", oid).single();
const { data: items } = await admin.from("order_items").select("id, meta").eq("order_id", oid);
const item = items?.[0];
const meta = item?.meta ?? {};
const tempIds = [
  meta.designTempId,
  ...(meta.additionalDesigns ?? []).map((d) => d.tempId),
].filter(Boolean);

let promoted = 0;
for (let slot = 0; slot < tempIds.length; slot++) {
  const designTempId = tempIds[slot];
  const version = slot + 1;
  const { data: temp, error } = await admin
    .from("design_temp_uploads")
    .select("*")
    .eq("id", designTempId)
    .eq("user_id", order.user_id)
    .maybeSingle();
  if (temp?.promoted_to) {
    console.log("skip", designTempId, "already promoted");
    continue;
  }
  const metaEntry =
    designTempId === meta.designTempId
      ? { fileName: meta.designFileName, mimeType: meta.designMimeType, sizeBytes: 0 }
      : (meta.additionalDesigns ?? []).find((d) => d.tempId === designTempId);
  if (error && !metaEntry) {
    console.log("skip", designTempId, error?.message ?? "no meta");
    continue;
  }
  const orderPath = `${oid}/${designTempId}.png`;
  const { data: existingByPath } = await admin
    .from("design_files")
    .select("id")
    .eq("order_id", oid)
    .eq("storage_path", orderPath)
    .neq("status", "superseded")
    .maybeSingle();
  if (existingByPath) {
    console.log("already linked", designTempId);
    continue;
  }

  const tempPath = temp?.storage_path ?? `temp/${order.user_id}/${designTempId}.png`;
  const fileName = tempPath.split("/").pop();
  const newPath = `${oid}/${fileName}`;

  let ready = false;
  const dlOrder = await admin.storage.from(BUCKET).download(newPath);
  if (!dlOrder.error) ready = true;
  else {
    const mv = await admin.storage.from(BUCKET).move(tempPath, newPath);
    if (!mv.error) ready = true;
    else {
      const cp = await admin.storage.from(BUCKET).copy(tempPath, newPath);
      ready = !cp.error;
    }
  }
  if (!ready) {
    const dlAlt = await admin.storage.from(BUCKET).download(orderPath);
    if (dlAlt.error) {
      console.error("storage fail", designTempId, dlAlt.error.message);
      continue;
    }
  }

  const storagePath = !dlOrder.error ? newPath : orderPath;
  const fileId = randomUUID();
  const { error: insErr } = await admin.from("design_files").insert({
    id: fileId,
    order_id: oid,
    user_id: order.user_id,
    order_item_id: item.id,
    storage_path: storagePath,
    original_name: temp?.original_name ?? metaEntry?.fileName ?? `${designTempId}.png`,
    size_bytes: temp?.size_bytes ?? metaEntry?.sizeBytes ?? 0,
    mime_type: temp?.mime_type ?? metaEntry?.mimeType ?? "image/png",
    sha256: temp?.sha256 ?? null,
    version,
    status: "analyzing",
  });
  if (insErr) {
    console.error("insert fail", designTempId, insErr.message);
    continue;
  }
  if (temp?.id) {
    await admin.from("design_temp_uploads").update({ promoted_to: fileId }).eq("id", temp.id);
  }
  promoted++;
  console.log("promoted", metaEntry?.fileName ?? designTempId, "->", fileId);
}
console.log("total promoted:", promoted);

const { data: dfs } = await admin
  .from("design_files")
  .select("id, original_name, status")
  .eq("order_id", oid)
  .neq("status", "superseded");
console.log("design_files:", dfs);
