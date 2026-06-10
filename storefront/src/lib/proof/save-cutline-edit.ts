import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadToR2, r2KeyBuilders } from "@/lib/storage/r2-client";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { runProofValidationAfterEdit } from "@/lib/proof/orchestrator";
import type { Database, Enums, Json, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import { sanitizeSvg } from "@/lib/upload/sanitize-svg";

const ALLOWED_SOURCES = new Set([
  "raster",
  "vector",
  "vector-with-cutline",
  "psd",
]);
const ALLOWED_MODES = new Set(["contour", "hull", "rect", "circle"]);
const ALLOWED_SEVERITY = new Set(["ok", "warn", "err"]);
const ALLOWED_MATERIALS = new Set([
  "paper",
  "transparent",
  "metallic",
  "holographic",
]);
const ALLOWED_WHITE_MODES = new Set(["off", "full", "smart", "ai"]);
const ALLOWED_TIERS = new Set(["pro", "standard", "improve"]);
const ALLOWED_CUTLINE_SOURCES = new Set([
  "file_embedded",
  "auto_generated",
  "prior",
  "geo_shape",
  "operator",
]);

const MAX_SVG_SIZE = 2 * 1024 * 1024;
const MAX_PREVIEW_PNG_SIZE = 1 * 1024 * 1024;

export interface SaveCutlineEditBody {
  svg: string;
  preview_png_base64?: string | null;
  source: string;
  mode: string;
  offset_mm?: number | null;
  smoothness?: number | null;
  dpi?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  cutline_width_mm?: number | null;
  cutline_height_mm?: number | null;
  image_placement?: { x: number; y: number; scale: number } | null;
  pim_feedback?: string | null;
  pim_severity?: string | null;
  material_type?: string | null;
  white_plan_mode?: string | null;
  white_plan_path_count?: number;
  has_custom_white_plan?: boolean;
  tier?: string | null;
  detected_cut_contour_names?: string[];
  cutline_source?: string | null;
  detection_method?: string | null;
  auto?: boolean;
  design_file_id?: string | null;
}

export type SaveCutlineEditResult =
  | {
      ok: true;
      cutlineId: string;
      svgKey: string;
      previewKey: string | null;
      tier: string | null;
      materialType: string | null;
      whitePlanMode: string | null;
    }
  | { ok: false; error: string; status: number };

function parseBody(raw: SaveCutlineEditBody): SaveCutlineEditResult | {
  parsed: {
    svg: string;
    source: string;
    mode: string;
    pimSeverity: string | null;
    materialType: string | null;
    whitePlanMode: string | null;
    whitePlanPathCount: number;
    hasCustomWhitePlan: boolean;
    tier: string | null;
    detectedCutNames: string[];
    cutlineSource: string | null;
    detectionMethod: string | null;
    designFileId: string | null;
    isAuto: boolean;
    previewB64: string | null;
    offset_mm: number | null;
    smoothness: number | null;
    dpi: number | null;
    width_mm: number | null;
    height_mm: number | null;
    cutline_width_mm: number | null;
    cutline_height_mm: number | null;
    placement_json: Json | null;
    pim_feedback: string | null;
  };
} {
  const rawSvg = typeof raw.svg === "string" ? raw.svg : "";
  if (!rawSvg || rawSvg.length > MAX_SVG_SIZE) {
    return { ok: false, error: "SVG geçersiz veya çok büyük (>2MB)", status: 400 };
  }
  let svg: string;
  try {
    svg = sanitizeSvg(rawSvg);
  } catch {
    return { ok: false, error: "SVG geçersiz veya güvenlik kontrolünden geçemedi", status: 400 };
  }
  const source = typeof raw.source === "string" ? raw.source : "";
  const mode = typeof raw.mode === "string" ? raw.mode : "";
  if (!ALLOWED_SOURCES.has(source) || !ALLOWED_MODES.has(mode)) {
    return { ok: false, error: "source/mode geçersiz", status: 400 };
  }

  const pimSeverity =
    typeof raw.pim_severity === "string" && ALLOWED_SEVERITY.has(raw.pim_severity)
      ? raw.pim_severity
      : null;
  const materialType =
    typeof raw.material_type === "string" &&
    ALLOWED_MATERIALS.has(raw.material_type)
      ? raw.material_type
      : null;
  const rawWhiteMode =
    typeof raw.white_plan_mode === "string" ? raw.white_plan_mode : null;
  if (rawWhiteMode === "custom") {
    return {
      ok: false,
      error: "Özel beyaz plan modu desteklenmiyor — Tam veya Akıllı seç",
      status: 400,
    };
  }
  const whitePlanMode =
    rawWhiteMode && ALLOWED_WHITE_MODES.has(rawWhiteMode) ? rawWhiteMode : null;
  const whitePlanPathCount =
    typeof raw.white_plan_path_count === "number" &&
    raw.white_plan_path_count >= 0 &&
    raw.white_plan_path_count < 10000
      ? Math.floor(raw.white_plan_path_count)
      : 0;
  const hasCustomWhitePlan = raw.has_custom_white_plan === true;
  const tier =
    typeof raw.tier === "string" && ALLOWED_TIERS.has(raw.tier) ? raw.tier : null;
  const detectedCutNames = (() => {
    if (!Array.isArray(raw.detected_cut_contour_names)) return [];
    return raw.detected_cut_contour_names
      .filter((x): x is string => typeof x === "string")
      .slice(0, 10)
      .map((s) => s.slice(0, 100));
  })();
  const cutlineSource =
    typeof raw.cutline_source === "string" &&
    ALLOWED_CUTLINE_SOURCES.has(raw.cutline_source)
      ? raw.cutline_source
      : raw.auto === true
        ? "auto_generated"
        : null;
  const detectionMethod =
    typeof raw.detection_method === "string"
      ? raw.detection_method.slice(0, 64)
      : null;
  const designFileId =
    typeof raw.design_file_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      raw.design_file_id
    )
      ? raw.design_file_id
      : null;
  const previewB64 =
    typeof raw.preview_png_base64 === "string"
      ? raw.preview_png_base64.replace(/^data:image\/png;base64,/, "")
      : null;

  const cutline_width_mm =
    typeof raw.cutline_width_mm === "number" && raw.cutline_width_mm > 0
      ? raw.cutline_width_mm
      : null;
  const cutline_height_mm =
    typeof raw.cutline_height_mm === "number" && raw.cutline_height_mm > 0
      ? raw.cutline_height_mm
      : null;
  let placement_json: Json | null = null;
  if (
    raw.image_placement &&
    typeof raw.image_placement === "object" &&
    typeof raw.image_placement.x === "number" &&
    typeof raw.image_placement.y === "number" &&
    typeof raw.image_placement.scale === "number"
  ) {
    placement_json = {
      x: raw.image_placement.x,
      y: raw.image_placement.y,
      scale: raw.image_placement.scale,
    };
  }

  return {
    parsed: {
      svg,
      source,
      mode,
      pimSeverity,
      materialType,
      whitePlanMode,
      whitePlanPathCount,
      hasCustomWhitePlan,
      tier,
      detectedCutNames,
      cutlineSource,
      detectionMethod,
      designFileId,
      isAuto: raw.auto === true,
      previewB64,
      offset_mm: typeof raw.offset_mm === "number" ? raw.offset_mm : null,
      smoothness: typeof raw.smoothness === "number" ? raw.smoothness : null,
      dpi: typeof raw.dpi === "number" ? raw.dpi : null,
      width_mm: typeof raw.width_mm === "number" ? raw.width_mm : null,
      height_mm: typeof raw.height_mm === "number" ? raw.height_mm : null,
      cutline_width_mm,
      cutline_height_mm,
      placement_json,
      pim_feedback:
        typeof raw.pim_feedback === "string"
          ? raw.pim_feedback.slice(0, 2000)
          : null,
    },
  };
}

/**
 * Cutline kaydı — save-edit route ve server-side orchestrator ortak kullanır.
 */
export async function saveCutlineEdit(
  admin: SupabaseClient<Database>,
  args: {
    orderId: string;
    itemId: string;
    actorUserId: string;
    actorRole: "customer" | "partner" | "system";
    isPartner?: boolean;
    /** Pre-order editör draft → sipariş bağlama (status check gevşetilir) */
    editorPromote?: boolean;
    body: SaveCutlineEditBody;
  }
): Promise<SaveCutlineEditResult> {
  const { orderId, itemId, actorUserId, isPartner = false, editorPromote = false, body } = args;
  const parsedResult = parseBody(body);
  if ("ok" in parsedResult && !parsedResult.ok) {
    return parsedResult;
  }
  const {
    svg,
    source,
    mode,
    pimSeverity,
    materialType,
    whitePlanMode,
    whitePlanPathCount,
    hasCustomWhitePlan,
    tier,
    detectedCutNames,
    cutlineSource,
    detectionMethod,
    designFileId,
    isAuto,
    previewB64,
    offset_mm,
    smoothness,
    dpi,
    width_mm,
    height_mm,
    cutline_width_mm,
    cutline_height_mm,
    placement_json,
    pim_feedback,
  } = (parsedResult as { parsed: NonNullable<ReturnType<typeof parseBody> extends { parsed: infer P } ? P : never> }).parsed;

  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return { ok: false, error: "Sipariş bulunamadı", status: 404 };
  }

  if (!isPartner && !editorPromote) {
    const allowedStatuses = isAuto
      ? ["proof_generating", "proof_pending"]
      : ["proof_pending"];
    if (!allowedStatuses.includes(orderRow.status)) {
      return {
        ok: false,
        error: `Düzenleme bu aşamada yapılamaz (${orderRow.status})`,
        status: 400,
      };
    }
  }

  const { data: itemRow } = await admin
    .from("order_items")
    .select("id")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!itemRow) {
    return { ok: false, error: "Sipariş kalemi bulunamadı", status: 404 };
  }

  const timestamp = Date.now();
  const svgKey = r2KeyBuilders.cutlineDesign(orderId, itemId, timestamp);
  const upload = await uploadToR2({
    key: svgKey,
    body: svg,
    contentType: "image/svg+xml",
    metadata: {
      "order-id": orderId,
      "item-id": itemId,
      "user-id": actorUserId,
    },
  });
  if (!upload.success) {
    return {
      ok: false,
      error: "SVG depolanamadı",
      status: 500,
    };
  }

  let previewKey: string | null = null;
  if (previewB64) {
    try {
      const previewBuf = Buffer.from(previewB64, "base64");
      if (previewBuf.length <= MAX_PREVIEW_PNG_SIZE) {
        previewKey = r2KeyBuilders.cutlinePreview(orderId, itemId, timestamp);
        const previewUpload = await uploadToR2({
          key: previewKey,
          body: previewBuf,
          contentType: "image/png",
        });
        if (!previewUpload.success) previewKey = null;
      }
    } catch (err) {
      console.warn("[save-cutline-edit] preview decode failed:", err);
    }
  }

  const cdInsert: TablesInsert<"cutline_designs"> = {
    order_id: orderId,
    order_item_id: itemId,
    design_file_id: designFileId,
    user_id: actorUserId,
    svg_url: svgKey,
    preview_png_url: previewKey,
    source,
    mode,
    offset_mm,
    smoothness,
    dpi,
    width_mm,
    height_mm,
    cutline_width_mm,
    cutline_height_mm,
    placement_json,
    pim_feedback,
    pim_severity: pimSeverity,
    status: isAuto ? "auto_generated" : "draft",
    material_type: materialType,
    white_plan_mode: whitePlanMode,
    white_plan_path_count: whitePlanPathCount,
    has_custom_white_plan: hasCustomWhitePlan,
    tier,
    detected_cut_contour_names: detectedCutNames as Json | null,
    cutline_source: cutlineSource,
    detection_method: detectionMethod,
  };

  const { data: cd, error: cdErr } = await admin
    .from("cutline_designs")
    .insert(cdInsert)
    .select("id")
    .single();
  if (cdErr) {
    console.error("[save-cutline-edit] cutline_designs insert:", cdErr);
    return { ok: false, error: "Bıçak kaydı oluşturulamadı", status: 500 };
  }
  const cutlineId = (cd as { id: string }).id;

  {
    const supersedeQuery = admin
      .from("cutline_designs")
      .update({ status: "superseded" })
      .eq("order_item_id", itemId)
      .in("status", ["draft", "auto_generated"])
      .neq("id", cutlineId);
    if (designFileId) {
      await supersedeQuery.eq("design_file_id", designFileId);
    } else {
      await supersedeQuery.is("design_file_id", null);
    }
  }

  const newProofStatus = isAuto
    ? "pending"
    : isPartner
      ? "partner_revised"
      : "edited";
  await admin
    .from("order_items")
    .update({
      proof_status: newProofStatus,
      proof_edited_at: new Date().toISOString(),
      cutline_design_id: cutlineId,
      ...(isPartner
        ? {
            partner_decided_by: actorUserId,
            partner_decided_at: new Date().toISOString(),
            partner_decision_note: "POC editör ile revize",
          }
        : {}),
    } satisfies TablesUpdate<"order_items">)
    .eq("id", itemId)
    .eq("order_id", orderId);

  const actorRole = isAuto ? "system" : isPartner ? "partner" : "customer";
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: isAuto
        ? "proof_auto_generated"
        : isPartner
          ? "partner_revised_item"
          : "proof_item_edited",
      status_after: orderRow.status as Enums<"order_status">,
      actor_id: actorUserId,
      actor_role: actorRole,
      summary: isAuto
        ? `Otomatik bıçak üretildi (${mode}, ${source}${tier ? `, tier:${tier}` : ""})`
        : isPartner
          ? `Partner bıçak çizgisini revize etti (${mode}, ${source}${tier ? `, tier:${tier}` : ""})`
          : `Müşteri bıçak çizgisini düzenledi (${mode}, ${source}${tier ? `, tier:${tier}` : ""}${materialType && materialType !== "paper" ? `, ${materialType}` : ""})`,
      detail: {
        item_id: itemId,
        cutline_id: cutlineId,
        mode,
        source,
        material_type: materialType,
        white_plan_mode: whitePlanMode,
        tier,
        auto: isAuto,
      },
    } satisfies TablesInsert<"order_events">,
  ]);

  if (!isAuto && !isPartner && orderRow.status === "proof_pending") {
    const { data: itemDims } = await admin
      .from("order_items")
      .select("width, height, meta")
      .eq("id", itemId)
      .eq("order_id", orderId)
      .maybeSingle();
    const itemDimsRow = itemDims as {
      width: number;
      height: number;
      meta: Record<string, unknown> | null;
    } | null;

    const dfQuery = admin
      .from("design_files")
      .select("storage_path, original_name")
      .eq("order_id", orderId)
      .eq("order_item_id", itemId)
      .neq("status", "superseded");
    const { data: dfRow } = designFileId
      ? await dfQuery.eq("id", designFileId).maybeSingle()
      : await dfQuery.order("version", { ascending: false }).limit(1).maybeSingle();
    const designFile = dfRow as {
      storage_path: string;
      original_name: string;
    } | null;

    if (itemDimsRow && designFile) {
      const { data: signed } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(designFile.storage_path, 300);
      if (signed?.signedUrl) {
        const materialKey = String(
          itemDimsRow.meta?.material_type ??
            itemDimsRow.meta?.material ??
            "paper"
        );
        void runProofValidationAfterEdit({
          orderId,
          itemId,
          designFileId,
          svg,
          fileName: designFile.original_name,
          designFileUrl: signed.signedUrl,
          materialKey,
          designWidth: itemDimsRow.width,
          designHeight: itemDimsRow.height,
        });
      }
    }
  }

  return {
    ok: true,
    cutlineId,
    svgKey,
    previewKey,
    tier,
    materialType,
    whitePlanMode,
  };
}
