import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import {
  downloadFromR2,
  getR2ObjectInfo,
  getSignedDownloadUrl,
  uploadToR2,
} from "@/lib/storage/r2-client";
import { r2PrintPdfKey } from "@/lib/storage/buckets";
import { buildPrintReadyPdf } from "@/lib/print/build-print-pdf";
import { extractCutlineRingsFromSvg } from "@/lib/print/extract-cutline-rings";
import { resolveOrderDesignFile } from "@/lib/proof/resolve-order-design-file";

const DEFAULT_BLEED_MM = 2;

export type ProductionPdfResult =
  | {
      ok: true;
      cacheKey: string;
      pdfBytes: Uint8Array;
      cached: boolean;
    }
  | { ok: false; error: string; status: number };

export async function getOrBuildProductionPrintPdf(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  itemId: string;
  userId: string;
  designFileId: string | null;
}): Promise<ProductionPdfResult> {
  const cacheKey = r2PrintPdfKey(args.orderId, args.itemId);
  const existing = await getR2ObjectInfo(cacheKey);
  if (existing.exists) {
    const pdfBytes = await downloadFromR2(cacheKey);
    return {
      ok: true,
      cacheKey,
      pdfBytes: new Uint8Array(pdfBytes),
      cached: true,
    };
  }

  const cutlineQuery = args.admin
    .from("cutline_designs")
    .select(
      "svg_url, width_mm, height_mm, cutline_width_mm, cutline_height_mm, placement_json, status"
    )
    .eq("order_id", args.orderId)
    .eq("order_item_id", args.itemId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: cdRow } = args.designFileId
    ? await cutlineQuery.eq("design_file_id", args.designFileId).maybeSingle()
    : await cutlineQuery.maybeSingle();

  const cd = cdRow as {
    svg_url: string | null;
    width_mm: number | null;
    height_mm: number | null;
    cutline_width_mm: number | null;
    cutline_height_mm: number | null;
    placement_json: { x?: number; y?: number; scale?: number } | null;
  } | null;

  if (!cd?.svg_url) {
    return { ok: false, error: "Bıçak kaydı bulunamadı", status: 404 };
  }

  const { data: itemRow } = await args.admin
    .from("order_items")
    .select("width, height")
    .eq("id", args.itemId)
    .maybeSingle();

  const item = itemRow as { width: number; height: number } | null;
  const widthMm = cd.width_mm ?? item?.width ?? cd.cutline_width_mm ?? 50;
  const heightMm = cd.height_mm ?? item?.height ?? cd.cutline_height_mm ?? 50;

  let svgText: string;
  try {
    const svgBuf = await downloadFromR2(cd.svg_url);
    svgText = svgBuf.toString("utf-8");
  } catch {
    return { ok: false, error: "Bıçak SVG indirilemedi", status: 500 };
  }

  const cutlinePathMm = extractCutlineRingsFromSvg(svgText, widthMm, heightMm);
  if (cutlinePathMm.length === 0) {
    return { ok: false, error: "Bıçak path çıkarılamadı", status: 422 };
  }

  const resolved = await resolveOrderDesignFile(
    args.admin,
    args.orderId,
    args.itemId,
    args.userId,
    args.designFileId
  );
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      status: resolved.status,
    };
  }

  const { data: designBlob, error: dlErr } = await args.admin.storage
    .from(STORAGE_BUCKET)
    .download(resolved.file.storage_path);
  if (dlErr || !designBlob) {
    return { ok: false, error: "Tasarım dosyası indirilemedi", status: 500 };
  }

  const designBytes = new Uint8Array(await designBlob.arrayBuffer());
  const placement = cd.placement_json;
  const imagePlacement =
    placement &&
    typeof placement.x === "number" &&
    typeof placement.y === "number" &&
    typeof placement.scale === "number"
      ? { x: placement.x, y: placement.y, scale: placement.scale }
      : null;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildPrintReadyPdf({
      artwork: {
        bytes: designBytes,
        mimeType: resolved.file.mime_type,
        fileName: resolved.file.original_name,
      },
      cutlinePathMm,
      widthMm,
      heightMm,
      bleedMm: DEFAULT_BLEED_MM,
      imagePlacement,
    });
  } catch (err) {
    console.error("[production-pdf] build failed:", err);
    return { ok: false, error: "Print-ready PDF üretilemedi", status: 500 };
  }

  const upload = await uploadToR2({
    key: cacheKey,
    body: pdfBytes,
    contentType: "application/pdf",
  });
  if (!upload.success) {
    return { ok: false, error: "PDF cache yazılamadı", status: 500 };
  }

  return { ok: true, cacheKey, pdfBytes, cached: false };
}

export async function getProductionPrintPdfSignedUrl(
  cacheKey: string,
  orderId: string,
  itemId: string
): Promise<string> {
  return getSignedDownloadUrl(cacheKey, 3600, {
    contentType: "application/pdf",
    downloadFilename: `pim-print-ready-${orderId.slice(-6)}-${itemId.slice(-6)}.pdf`,
  });
}
