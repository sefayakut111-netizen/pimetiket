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
import { saveCutlineEdit } from "@/lib/proof/save-cutline-edit";
import { sendOrderProofRequired } from "@/lib/mail/notifications";

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
  material_type?: unknown;
  white_plan_mode?: unknown;
  white_plan_path_count?: unknown;
  has_custom_white_plan?: unknown;
  tier?: unknown;
  detected_cut_contour_names?: unknown;
  auto?: unknown;
  design_file_id?: unknown;
}

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

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

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

  const result = await saveCutlineEdit(admin, {
    orderId,
    itemId,
    actorUserId: user.id,
    actorRole: isPartner ? "partner" : "customer",
    isPartner,
    body: {
      svg: typeof body.svg === "string" ? body.svg : "",
      preview_png_base64:
        typeof body.preview_png_base64 === "string"
          ? body.preview_png_base64
          : null,
      source: typeof body.source === "string" ? body.source : "",
      mode: typeof body.mode === "string" ? body.mode : "",
      offset_mm: typeof body.offset_mm === "number" ? body.offset_mm : null,
      smoothness:
        typeof body.smoothness === "number" ? body.smoothness : null,
      dpi: typeof body.dpi === "number" ? body.dpi : null,
      width_mm: typeof body.width_mm === "number" ? body.width_mm : null,
      height_mm: typeof body.height_mm === "number" ? body.height_mm : null,
      pim_feedback:
        typeof body.pim_feedback === "string" ? body.pim_feedback : null,
      pim_severity:
        typeof body.pim_severity === "string" ? body.pim_severity : null,
      material_type:
        typeof body.material_type === "string" ? body.material_type : null,
      white_plan_mode:
        typeof body.white_plan_mode === "string" ? body.white_plan_mode : null,
      white_plan_path_count:
        typeof body.white_plan_path_count === "number"
          ? body.white_plan_path_count
          : 0,
      has_custom_white_plan: body.has_custom_white_plan === true,
      tier: typeof body.tier === "string" ? body.tier : null,
      detected_cut_contour_names: Array.isArray(body.detected_cut_contour_names)
        ? body.detected_cut_contour_names.filter(
            (x): x is string => typeof x === "string"
          )
        : [],
      auto: body.auto === true,
      design_file_id:
        typeof body.design_file_id === "string" ? body.design_file_id : null,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (isPartner) {
    void sendOrderProofRequired({
      userId: orderRow.user_id,
      orderId,
    }).catch((err) => {
      console.error("[proof/save-edit] partner revise proof mail:", err);
    });
  }

  return NextResponse.json({
    ok: true,
    cutlineId: result.cutlineId,
    svgKey: result.svgKey,
    previewKey: result.previewKey,
    tier: result.tier,
    materialType: result.materialType,
    whitePlanMode: result.whitePlanMode,
  });
}
