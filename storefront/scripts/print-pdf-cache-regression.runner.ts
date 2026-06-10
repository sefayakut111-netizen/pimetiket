/**
 * Print PDF R2 cache — ardışık iki head: miss → hit (0→1).
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  deleteFromR2,
  downloadFromR2,
  getR2ObjectInfo,
  uploadToR2,
} from "../src/lib/storage/r2-client";
import { r2PrintPdfKey } from "../src/lib/storage/buckets";
import { buildPrintReadyPdf } from "../src/lib/print/build-print-pdf";
import { extractCutlineRingsFromSvg } from "../src/lib/print/extract-cutline-rings";
import { STORAGE_BUCKET } from "../src/lib/storage/design-files";

config({ path: resolve(process.cwd(), ".env.local") });

const ORDER_ID = "070620263770";
const ITEM_ID = "0d7f2f8f-0df7-4deb-9bba-5af3844575d2";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function buildPdfForOrder() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik");

  const admin = createClient(url, key);
  const { data: cd } = await admin
    .from("cutline_designs")
    .select("svg_url, width_mm, height_mm, placement_json, design_file_id")
    .eq("order_id", ORDER_ID)
    .eq("order_item_id", ITEM_ID)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cd?.svg_url) throw new Error("cutline yok");

  const widthMm = Number(cd.width_mm) || 70;
  const heightMm = Number(cd.height_mm) || 70;
  const svgBuf = await downloadFromR2(cd.svg_url);
  const cutlinePathMm = extractCutlineRingsFromSvg(
    svgBuf.toString("utf-8"),
    widthMm,
    heightMm
  );

  let dq = admin
    .from("design_files")
    .select("storage_path, mime_type, original_name")
    .eq("order_id", ORDER_ID)
    .eq("order_item_id", ITEM_ID)
    .order("created_at", { ascending: false })
    .limit(1);
  if (cd.design_file_id) dq = dq.eq("id", cd.design_file_id);
  const { data: df } = await dq.maybeSingle();
  if (!df?.storage_path) throw new Error("design_files yok");

  const { data: blob } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(df.storage_path);
  if (!blob) throw new Error("tasarım indirilemedi");

  const placement = cd.placement_json as {
    x?: number;
    y?: number;
    scale?: number;
  } | null;
  const imagePlacement =
    placement &&
    typeof placement.x === "number" &&
    typeof placement.y === "number" &&
    typeof placement.scale === "number"
      ? { x: placement.x, y: placement.y, scale: placement.scale }
      : null;

  return buildPrintReadyPdf({
    artwork: {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: df.mime_type,
      fileName: df.original_name,
    },
    cutlinePathMm,
    widthMm,
    heightMm,
    bleedMm: 2,
    imagePlacement,
  });
}

async function simulateGetOrBuild(): Promise<"0" | "1"> {
  const cacheKey = r2PrintPdfKey(ORDER_ID, ITEM_ID);
  const existing = await getR2ObjectInfo(cacheKey);
  if (existing.exists) return "1";

  const pdfBytes = await buildPdfForOrder();
  const upload = await uploadToR2({
    key: cacheKey,
    body: Buffer.from(pdfBytes),
    contentType: "application/pdf",
  });
  if (!upload.success) {
    throw new Error(`upload failed: ${upload.error}`);
  }
  return "0";
}

async function main() {
  const cacheKey = r2PrintPdfKey(ORDER_ID, ITEM_ID);
  await deleteFromR2(cacheKey);
  assert(!(await getR2ObjectInfo(cacheKey)).exists, "cache should start empty");

  const first = await simulateGetOrBuild();
  assert(first === "0", `first pass expected cached 0, got ${first}`);
  assert(
    (await getR2ObjectInfo(cacheKey)).exists,
    "R2 key must exist after first pass"
  );

  const second = await simulateGetOrBuild();
  assert(second === "1", `second pass expected cached 1, got ${second}`);

  console.log("[print-pdf-cache-regression] OK");
  console.log(`  key: ${cacheKey}`);
  console.log("  pass1 X-Pim-Print-Cached: 0");
  console.log("  pass2 X-Pim-Print-Cached: 1");
}

main().catch((err) => {
  console.error("[print-pdf-cache-regression] FAIL:", err);
  process.exit(1);
});
