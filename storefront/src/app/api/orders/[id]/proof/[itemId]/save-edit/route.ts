/**
 * POST /api/orders/[id]/proof/[itemId]/save-edit
 *
 * Sefa 19 May v68 (Migration 059):
 * Sefa'nın POC'u (pim_etiket_poc.html, CutlineDesigner) müşterinin
 * düzenlediği bıçak SVG'sini kaydeder.
 *
 * Akış:
 *   1. Müşteri /onay/[id]/duzenle/[itemId] sayfasında POC ile bıçağı oynar
 *   2. "Kaydet" → bu endpoint
 *   3. SVG R2'ye upload (customer-cutlines/{orderId}/{itemId}/{ts}.svg)
 *   4. cutline_designs satırı insert (status='draft')
 *   5. order_items.proof_status = 'edited'
 *   6. Geri dön → onay sayfasında "tekrar onayla" butonu çıkar
 *
 * Body (multipart YOK — JSON):
 *   {
 *     svg: string,           // ham SVG metni (R2'ye yazılacak)
 *     preview_png_base64?: string,  // opsiyonel canvas snapshot
 *     source: 'raster' | 'vector' | 'vector-with-cutline' | 'psd',
 *     mode: 'contour' | 'hull' | 'rect' | 'circle',
 *     offset_mm?: number,
 *     smoothness?: number,
 *     dpi?: number,
 *     width_mm?: number,
 *     height_mm?: number,
 *     pim_feedback?: string,
 *     pim_severity?: 'ok' | 'warn' | 'err',
 *
 *     // POC v2 (Mig 060) — malzeme + beyaz plan + tier
 *     material_type?: 'paper' | 'transparent' | 'metallic' | 'holographic',
 *     white_plan_mode?: 'off' | 'full' | 'smart' | 'ai' | 'custom',
 *     white_plan_path_count?: number,
 *     has_custom_white_plan?: boolean,
 *     tier?: 'pro' | 'standard' | 'improve',
 *     detected_cut_contour_names?: string[],
 *   }
 *
 * NOT: SVG max ~2MB sınırı vardır (Next.js body limit). POC v2 artık
 * White + CutContour iki spot color grubu olarak SVG'de yazıyor —
 * boyut hâlâ 50-300KB civarında.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, r2KeyBuilders } from "@/lib/storage/r2-client";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { runProofValidationAfterEdit } from "@/lib/proof/orchestrator";
import type { Enums, Json, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

interface Body {
  svg?: unknown;
  preview_png_base64?: unknown;
  source?: unknown;
  mode?: unknown;
  offset_mm?: unknown;
  smoothness?: unknown;
  dpi?: unknown;
  width_mm?: unknown;
  height_mm?: unknown;
  pim_feedback?: unknown;
  pim_severity?: unknown;
  // POC v2 (Mig 060)
  material_type?: unknown;
  white_plan_mode?: unknown;
  white_plan_path_count?: unknown;
  has_custom_white_plan?: unknown;
  tier?: unknown;
  detected_cut_contour_names?: unknown;
  // Mig 062 — auto-generated cutline (B1+B2: hidden iframe POC)
  auto?: unknown;
  // Mig 063 — multi-design proof: hangi design_file için cutline
  design_file_id?: unknown;
}

const ALLOWED_SOURCES = new Set([
  "raster",
  "vector",
  "vector-with-cutline",
  "psd",
]);
const ALLOWED_MODES = new Set(["contour", "hull", "rect", "circle"]);
const ALLOWED_SEVERITY = new Set(["ok", "warn", "err"]);
// POC v2 enum'ları
const ALLOWED_MATERIALS = new Set([
  "paper",
  "transparent",
  "metallic",
  "holographic",
]);
const ALLOWED_WHITE_MODES = new Set([
  "off",
  "full",
  "smart",
  "ai",
  "custom",
]);
const ALLOWED_TIERS = new Set(["pro", "standard", "improve"]);

const MAX_SVG_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_PREVIEW_PNG_SIZE = 1 * 1024 * 1024; // 1 MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validation
  const svg = typeof body.svg === "string" ? body.svg : null;
  if (!svg || !svg.includes("<svg") || svg.length > MAX_SVG_SIZE) {
    return NextResponse.json(
      { error: "SVG geçersiz veya çok büyük (>2MB)" },
      { status: 400 }
    );
  }
  const source = typeof body.source === "string" ? body.source : "";
  const mode = typeof body.mode === "string" ? body.mode : "";
  if (!ALLOWED_SOURCES.has(source) || !ALLOWED_MODES.has(mode)) {
    return NextResponse.json(
      { error: "source/mode geçersiz" },
      { status: 400 }
    );
  }
  const pimSeverity =
    typeof body.pim_severity === "string" &&
    ALLOWED_SEVERITY.has(body.pim_severity)
      ? body.pim_severity
      : null;

  // POC v2 alanları — opsiyonel, geçersizse null'a düşür
  const materialType =
    typeof body.material_type === "string" &&
    ALLOWED_MATERIALS.has(body.material_type)
      ? body.material_type
      : null;
  const whitePlanMode =
    typeof body.white_plan_mode === "string" &&
    ALLOWED_WHITE_MODES.has(body.white_plan_mode)
      ? body.white_plan_mode
      : null;
  const whitePlanPathCount =
    typeof body.white_plan_path_count === "number" &&
    body.white_plan_path_count >= 0 &&
    body.white_plan_path_count < 10000
      ? Math.floor(body.white_plan_path_count)
      : 0;
  const hasCustomWhitePlan = body.has_custom_white_plan === true;
  const tier =
    typeof body.tier === "string" && ALLOWED_TIERS.has(body.tier)
      ? body.tier
      : null;
  // detected_cut_contour_names: string[] max 10 öğe, her biri max 100 char
  const detectedCutNames = (() => {
    if (!Array.isArray(body.detected_cut_contour_names)) return [];
    return body.detected_cut_contour_names
      .filter((x: unknown): x is string => typeof x === "string")
      .slice(0, 10)
      .map((s: string) => s.slice(0, 100));
  })();
  // Mig 063 — design_file_id (multi-design proof). UUID format kontrolü.
  const designFileId =
    typeof body.design_file_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.design_file_id
    )
      ? body.design_file_id
      : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Auth + status check
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  // Sefa 23 May v68 (Partner P4): partner bypass — partner kendine
  // atanmış sipariş için bıçağı revize edebilir. Cross-tenant guard +
  // status check farklı (proof_pending değil, in_production veya
  // partner_review sonrası).
  let isPartner = false;
  if (orderRow.user_id !== user.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role === "partner") {
      const { data: contactRow } = await admin
        .from("partner_contacts")
        .select("partner_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const partnerId = (contactRow as { partner_id: string } | null)
        ?.partner_id;
      if (!partnerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: asgRow } = await admin
        .from("order_assignments")
        .select("fason_partner_id")
        .eq("order_id", orderId)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const asgPartnerId = (asgRow as { fason_partner_id: string } | null)
        ?.fason_partner_id;
      if (asgPartnerId !== partnerId) {
        return NextResponse.json(
          { error: "not_your_order" },
          { status: 403 }
        );
      }
      isPartner = true;
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Mig 062: proof_generating de geçerli — hidden iframe POC otomatik üretirken
  // bu state'te olur. Cutline INSERT'i fn_advance_after_cutline ile
  // otomatik proof_pending'e geçirir.
  // Partner için status check yapma — order in_production veya başka state'te
  // olabilir (partner zaten karar verme yetkisine sahip).
  const isAuto = body.auto === true;
  if (!isPartner) {
    const allowedStatuses = isAuto
      ? ["proof_generating", "proof_pending"]
      : ["proof_pending"];
    if (!allowedStatuses.includes(orderRow.status)) {
      return NextResponse.json(
        { error: `Düzenleme bu aşamada yapılamaz (${orderRow.status})` },
        { status: 400 }
      );
    }
  }

  // Item gerçekten bu siparişe mi ait?
  const { data: itemRow } = await admin
    .from("order_items")
    .select("id")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!itemRow) {
    return NextResponse.json(
      { error: "Sipariş kalemi bulunamadı" },
      { status: 404 }
    );
  }

  // R2 upload — SVG
  const timestamp = Date.now();
  const svgKey = r2KeyBuilders.cutlineDesign(orderId, itemId, timestamp);
  const upload = await uploadToR2({
    key: svgKey,
    body: svg,
    contentType: "image/svg+xml",
    metadata: {
      "order-id": orderId,
      "item-id": itemId,
      "user-id": user.id,
    },
  });
  if (!upload.success) {
    return NextResponse.json(
      { error: "SVG depolanamadı", detail: upload.error },
      { status: 500 }
    );
  }

  // R2 upload — preview PNG (opsiyonel)
  let previewKey: string | null = null;
  const previewB64 =
    typeof body.preview_png_base64 === "string"
      ? body.preview_png_base64.replace(/^data:image\/png;base64,/, "")
      : null;
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
      console.warn("[proof/save-edit] preview decode failed:", err);
    }
  }

  // cutline_designs INSERT
  const cdInsert: TablesInsert<"cutline_designs"> = {
    order_id: orderId,
    order_item_id: itemId,
    design_file_id: designFileId, // Mig 063 — multi-design proof
    user_id: user.id,
    svg_url: svgKey,
    preview_png_url: previewKey,
    source,
    mode,
    offset_mm:
      typeof body.offset_mm === "number" ? body.offset_mm : null,
    smoothness:
      typeof body.smoothness === "number" ? body.smoothness : null,
    dpi: typeof body.dpi === "number" ? body.dpi : null,
    width_mm:
      typeof body.width_mm === "number" ? body.width_mm : null,
    height_mm:
      typeof body.height_mm === "number" ? body.height_mm : null,
    pim_feedback:
      typeof body.pim_feedback === "string"
        ? body.pim_feedback.slice(0, 2000)
        : null,
    pim_severity: pimSeverity,
    // Mig 062: auto=true ise auto_generated, müşteri manuel düzenlediyse draft
    status: isAuto ? "auto_generated" : "draft",
    // POC v2 (Mig 060)
    material_type: materialType,
    white_plan_mode: whitePlanMode,
    white_plan_path_count: whitePlanPathCount,
    has_custom_white_plan: hasCustomWhitePlan,
    tier,
    detected_cut_contour_names: detectedCutNames as Json | null,
  };

  const { data: cd, error: cdErr } = await admin
    .from("cutline_designs")
    .insert(cdInsert)
    .select("id")
    .single();
  if (cdErr) {
    console.error("[proof/save-edit] cutline_designs insert:", cdErr);
    return NextResponse.json(
      { error: "Bıçak kaydı oluşturulamadı" },
      { status: 500 }
    );
  }
  const cutlineId = (cd as { id: string }).id;

  // Önceki draft + auto_generated'ları superseded yap. Multi-design (Mig 063):
  // design_file_id varsa o tasarıma özel scope; yoksa item-bağlı eski kayıtlar.
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
      // Eski (design_file_id null) kayıtlar — item başına tek scope
      await supersedeQuery.is("design_file_id", null);
    }
  }

  // order_items proof_status:
  //   - auto = pending (henüz müşteri görmedi)
  //   - manual customer = edited (müşteri ayarladı)
  //   - manual partner (Sefa P4) = partner_revised (müşteri tekrar görsün)
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
            partner_decided_by: user.id,
            partner_decided_at: new Date().toISOString(),
            partner_decision_note: "POC editör ile revize",
          }
        : {}),
    } satisfies TablesUpdate<"order_items">)
    .eq("id", itemId)
    .eq("order_id", orderId);

  // order_events
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: isAuto
        ? "proof_auto_generated"
        : isPartner
          ? "partner_revised_item"
          : "proof_item_edited",
      status_after: orderRow.status as Enums<"order_status">,
      actor_id: user.id,
      actor_role: isAuto ? "system" : isPartner ? "partner" : "customer",
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

  // Müşteri manuel düzenleme → proof_validating + arka plan doğrulama
  if (!isAuto && !isPartner && orderRow.status === "proof_pending") {
    const { data: itemDims } = await admin
      .from("order_items")
      .select("width, height, meta")
      .eq("id", itemId)
      .eq("order_id", orderId)
      .maybeSingle();
    const itemRow = itemDims as {
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

    if (itemRow && designFile) {
      const { data: signed } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(designFile.storage_path, 300);
      if (signed?.signedUrl) {
        const materialKey = String(
          itemRow.meta?.material_type ?? itemRow.meta?.material ?? "paper"
        );
        void runProofValidationAfterEdit({
          orderId,
          itemId,
          designFileId,
          svg,
          fileName: designFile.original_name,
          designFileUrl: signed.signedUrl,
          materialKey,
          designWidth: itemRow.width,
          designHeight: itemRow.height,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    cutlineId,
    svgKey,
    previewKey,
    tier,
    materialType,
    whitePlanMode,
  });
}
