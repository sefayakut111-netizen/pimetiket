/**
 * GET /api/admin/orders/[id]/proof
 *
 * Sefa 23 May v68 (Admin proof inceleme akisi):
 * /admin/prova/[orderId] sayfasi icin admin-tarafi proof summary.
 *
 * Müşteri /api/orders/[id]/proof endpoint'i fn_proof_summary RPC kullanir,
 * RPC içinde auth.uid() kontrolü olduğu için admin (service_role) ile bile
 * çağrılamaz. Bu endpoint raw query ile aynı şekli oluşturur.
 *
 * Auth: profiles.role admin veya staff
 *
 * Response (fn_proof_summary ile aynı):
 *   {
 *     order: { id, status, subtotal, ... , customer_email, address },
 *     items: [{
 *       id, product, title, config, width, height, qty, unit, total, meta,
 *       proof_status, proof_viewed_at, proof_approved_at,
 *       designs: [{ design_file_id, file_name, mime_type, size_bytes,
 *                   version, design_status, cutline: { ... } | null }],
 *       cutline: { ... } | null (geriye uyumluluk — designs boşsa item-bağlı),
 *       help_request: { ... } | null
 *     }]
 *   }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  if (!rawOrderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("proof", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Order — case-insensitive lookup
  const { data: orderRow } = await admin
    .from("orders")
    .select(
      "id, user_id, status, subtotal, shipping, total, address, created_at, estimated_delivery, sla_proof_deadline"
    )
    .ilike("id", rawOrderId)
    .maybeSingle();
  type OrderRow = {
    id: string;
    user_id: string;
    status: string;
    subtotal: number;
    shipping: number;
    total: number;
    address: Record<string, unknown> | null;
    created_at: string;
    estimated_delivery: string | null;
    sla_proof_deadline: string | null;
  };
  const order = orderRow as OrderRow | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  // Customer email
  let customerEmail: string | null = null;
  try {
    const { data: userData } = await admin.auth.admin.getUserById(order.user_id);
    customerEmail = userData?.user?.email ?? null;
  } catch {
    /* sessiz */
  }

  // Items
  const { data: itemsRaw } = await admin
    .from("order_items")
    .select(
      "id, product, title, config, width, height, qty, unit, total, meta, proof_status, proof_viewed_at, proof_approved_at"
    )
    .eq("order_id", order.id)
    .order("id");
  type ItemRow = {
    id: string;
    product: string;
    title: string;
    config: string;
    width: number;
    height: number;
    qty: number;
    unit: number;
    total: number;
    meta: Record<string, unknown> | null;
    proof_status: string | null;
    proof_viewed_at: string | null;
    proof_approved_at: string | null;
  };
  const items = (itemsRaw as ItemRow[] | null) ?? [];

  // Design files (per item, non-superseded). itemIds bossa skip — UUID
  // kolonuna dummy string ("__none__") .in() ile gecmek PG'de 22P02
  // invalid_text_representation hatasi firlatir, endpoint 500 doner.
  const itemIds = items.map((i) => i.id);
  type DesignRow = {
    id: string;
    order_item_id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    version: number;
    status: string;
  };
  type CutlineRow = {
    id: string;
    design_file_id: string | null;
    order_item_id: string | null;
    svg_url: string | null;
    preview_png_url: string | null;
    source: string | null;
    mode: string | null;
    offset_mm: number | null;
    dpi: number | null;
    width_mm: number | null;
    height_mm: number | null;
    pim_feedback: string | null;
    pim_severity: string | null;
    status: string | null;
    material_type: string | null;
    white_plan_mode: string | null;
    white_plan_path_count: number | null;
    has_custom_white_plan: boolean | null;
    tier: string | null;
    detected_cut_contour_names: string[] | null;
    created_at: string;
  };
  type HrRow = {
    id: string;
    order_item_id: string;
    message: string;
    status: string;
    created_at: string;
    resolution_note: string | null;
  };

  const designsByItem = new Map<string, DesignRow[]>();
  const cutlineByDesign = new Map<string, CutlineRow>();
  const cutlineByItem = new Map<string, CutlineRow>();
  const hrByItem = new Map<string, HrRow>();

  if (itemIds.length > 0) {
    const { data: dfsRaw } = await admin
      .from("design_files")
      .select(
        "id, order_item_id, original_name, mime_type, size_bytes, version, status"
      )
      .in("order_item_id", itemIds)
      .neq("status", "superseded")
      .order("version", { ascending: true });
    for (const d of ((dfsRaw as DesignRow[] | null) ?? [])) {
      const arr = designsByItem.get(d.order_item_id) ?? [];
      arr.push(d);
      designsByItem.set(d.order_item_id, arr);
    }

    const designIds = (dfsRaw as DesignRow[] | null)?.map((d) => d.id) ?? [];
    const cutlineCols =
      "id, design_file_id, order_item_id, svg_url, preview_png_url, source, mode, offset_mm, dpi, width_mm, height_mm, pim_feedback, pim_severity, status, material_type, white_plan_mode, white_plan_path_count, has_custom_white_plan, tier, detected_cut_contour_names, created_at";

    if (designIds.length > 0) {
      const { data: cdsRaw } = await admin
        .from("cutline_designs")
        .select(cutlineCols)
        .in("design_file_id", designIds)
        .neq("status", "superseded")
        .order("created_at", { ascending: false });
      for (const c of ((cdsRaw as CutlineRow[] | null) ?? [])) {
        if (c.design_file_id && !cutlineByDesign.has(c.design_file_id)) {
          cutlineByDesign.set(c.design_file_id, c);
        }
      }
    }

    // Item-bağlı cutline (geriye uyumluluk — Mig 062 öncesi)
    const { data: itemCdsRaw } = await admin
      .from("cutline_designs")
      .select(cutlineCols)
      .in("order_item_id", itemIds)
      .is("design_file_id", null)
      .neq("status", "superseded")
      .order("created_at", { ascending: false });
    for (const c of ((itemCdsRaw as CutlineRow[] | null) ?? [])) {
      if (c.order_item_id && !cutlineByItem.has(c.order_item_id)) {
        cutlineByItem.set(c.order_item_id, c);
      }
    }

    // Open help requests
    const { data: hrsRaw } = await admin
      .from("proof_help_requests")
      .select("id, order_item_id, message, status, created_at, resolution_note")
      .in("order_item_id", itemIds)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false });
    for (const h of ((hrsRaw as HrRow[] | null) ?? [])) {
      if (!hrByItem.has(h.order_item_id)) hrByItem.set(h.order_item_id, h);
    }
  }

  // Shape JSON (fn_proof_summary ile aynı)
  const itemsJson = items.map((it) => {
    const designs = (designsByItem.get(it.id) ?? []).map((df) => {
      const cl = cutlineByDesign.get(df.id) ?? null;
      return {
        design_file_id: df.id,
        file_name: df.original_name,
        mime_type: df.mime_type,
        size_bytes: df.size_bytes,
        version: df.version,
        design_status: df.status,
        cutline: cl,
      };
    });
    const cutline = cutlineByItem.get(it.id) ?? null;
    const help = hrByItem.get(it.id) ?? null;
    return {
      id: it.id,
      product: it.product,
      title: it.title,
      config: it.config,
      width: it.width,
      height: it.height,
      qty: it.qty,
      unit: it.unit,
      total: it.total,
      meta: it.meta,
      proof_status: it.proof_status,
      proof_viewed_at: it.proof_viewed_at,
      proof_approved_at: it.proof_approved_at,
      designs,
      cutline,
      help_request: help,
    };
  });

  const summary = {
    total: items.length,
    pending: items.filter((i) => i.proof_status === "pending").length,
    viewed: items.filter((i) => i.proof_status === "viewed").length,
    approved: items.filter((i) => i.proof_status === "approved").length,
    edited: items.filter((i) => i.proof_status === "edited").length,
    help_requested: items.filter(
      (i) => i.proof_status === "help_requested"
    ).length,
  };

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      address: order.address,
      created_at: order.created_at,
      sla_proof_deadline: order.sla_proof_deadline,
      estimated_delivery: order.estimated_delivery,
      customer_email: customerEmail,
    },
    items: itemsJson,
    summary,
    // Sefa 23 May v68: /onay/duzenle admin'i status'ten bağımsız edit
    // edebilmeli — viewer_role bunu işaretler.
    viewer_role: auth.role,
  });
}
