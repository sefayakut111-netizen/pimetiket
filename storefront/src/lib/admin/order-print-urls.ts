import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";
import { SUPABASE_STORAGE_BUCKETS } from "@/lib/storage/buckets";

const TTL_SECONDS = 3600;

export type PrintFileType = "image" | "cutline" | "both";

export interface PrintUrlEntry {
  label: string;
  url: string;
  kind: "image" | "cutline";
}

interface CutlineRow {
  id: string;
  order_item_id: string;
  design_file_id: string | null;
  svg_url: string | null;
  preview_png_url: string | null;
  status: string;
  created_at: string;
}

interface DesignFileRow {
  id: string;
  order_item_id: string | null;
  original_name: string;
  storage_path: string;
}

interface ItemRow {
  id: string;
  title: string;
}

function pickCutline(
  cutlines: CutlineRow[],
  dfId: string | null,
  itemId: string
): CutlineRow | null {
  const candidates = cutlines.filter((c) =>
    dfId
      ? c.design_file_id === dfId
      : c.order_item_id === itemId && c.design_file_id === null
  );
  const approved = candidates.find((c) => c.status === "approved");
  return approved ?? candidates[0] ?? null;
}

async function signR2(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await getSignedDownloadUrl(key, TTL_SECONDS);
  } catch {
    return null;
  }
}

async function signDesign(
  admin: SupabaseClient,
  key: string | null
): Promise<string | null> {
  if (!key) return null;
  try {
    const { data } = await admin.storage
      .from(SUPABASE_STORAGE_BUCKETS.designs)
      .createSignedUrl(key, TTL_SECONDS);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Sipariş baskı dosyaları için imzalı URL listesi üretir (fason transfer logu).
 */
export async function buildOrderPrintUrls(
  admin: SupabaseClient,
  orderId: string,
  fileType: PrintFileType
): Promise<{ entries: PrintUrlEntry[]; expiresAt: string }> {
  const { data: items } = await admin
    .from("order_items")
    .select("id, title")
    .eq("order_id", orderId);
  const itemRows = (items as ItemRow[] | null) ?? [];

  const { data: dfs } = await admin
    .from("design_files")
    .select("id, order_item_id, original_name, storage_path")
    .eq("order_id", orderId)
    .neq("status", "superseded");
  const designFiles = (dfs as DesignFileRow[] | null) ?? [];

  const { data: cls } = await admin
    .from("cutline_designs")
    .select(
      "id, order_item_id, design_file_id, svg_url, preview_png_url, status, created_at"
    )
    .eq("order_id", orderId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false });
  const cutlineRows = (cls as CutlineRow[] | null) ?? [];

  const entries: PrintUrlEntry[] = [];

  for (const it of itemRows) {
    const itemDfs = designFiles.filter((df) => df.order_item_id === it.id);
    const dfsToProcess =
      itemDfs.length > 0
        ? itemDfs
        : [{ id: "", order_item_id: it.id, original_name: it.title, storage_path: "" }];

    for (const df of dfsToProcess) {
      const cl = pickCutline(
        cutlineRows,
        df.id || null,
        it.id
      );

      if (fileType === "image" || fileType === "both") {
        const designUrl = df.storage_path
          ? await signDesign(admin, df.storage_path)
          : null;
        if (designUrl) {
          entries.push({
            label: `${it.title} — ${df.original_name || "tasarım"}`,
            url: designUrl,
            kind: "image",
          });
        }
      }

      if (fileType === "cutline" || fileType === "both") {
        const cutSvg = cl ? await signR2(cl.svg_url) : null;
        if (cutSvg) {
          entries.push({
            label: `${it.title} — kesim hattı (SVG)`,
            url: cutSvg,
            kind: "cutline",
          });
        }
        const cutPreview = cl ? await signR2(cl.preview_png_url) : null;
        if (cutPreview) {
          entries.push({
            label: `${it.title} — kesim önizleme`,
            url: cutPreview,
            kind: "cutline",
          });
        }
      }
    }
  }

  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  return { entries, expiresAt };
}
