/**
 * GET /api/partner/orders/[id]
 *
 * Sefa 23 May v68 (Partner P3):
 * Partner sipariş detay sayfası için payload.
 *
 * Auth:
 *   1) role='partner' (middleware + double-check)
 *   2) order_assignments.fason_partner_id = partner'ın kendi id'si
 *      → BAŞKA partner'in siparişini görmek YASAK (cross-tenant izolasyon)
 *
 * Response shape (PII redacted):
 *   {
 *     order: {
 *       id, status, created_at, estimated_delivery,
 *       address_city, address_district  // sokak/cadde YOK (PII)
 *     },
 *     assignment: { id, status, assigned_at, estimated_delivery, ... },
 *     items: [{
 *       id, product, title, config, width, height, qty, proof_status,
 *       proof_approved_at,
 *       designs: [{ design_file_id, file_name, mime_type, version,
 *                   cutline: { preview_png_url, tier, mode, offset_mm } | null }]
 *     }],
 *     partner_decisions: { approved: N, rejected: N, pending: N }
 *   }
 *
 * NOT (Sefa kuralı): ₺ tutarı YOK, müşteri email/telefon YOK, müşteri
 * ad-soyad YOK. Sadece şehir/ilçe (kargo hazırlık için).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

  // 1) Auth
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profileRow as { role?: string } | null)?.role;
  if (role !== "partner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // user_id → fason_partners.id
  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("partner_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const contact = contactRow as { partner_id: string } | null;
  if (!contact) {
    return NextResponse.json(
      { error: "partner_link_missing" },
      { status: 404 }
    );
  }
  const partnerId = contact.partner_id;

  // 2) Canonical order lookup (case-insensitive)
  const { data: orderRow } = await admin
    .from("orders")
    .select(
      "id, status, created_at, estimated_delivery, address"
    )
    .ilike("id", rawOrderId)
    .maybeSingle();
  type OrderRow = {
    id: string;
    status: string;
    created_at: string;
    estimated_delivery: string | null;
    address: Record<string, unknown> | null;
  };
  const order = orderRow as OrderRow | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  // 3) Cross-tenant guard: bu sipariş bu partner'a atanmış mı?
  const { data: asgRow } = await admin
    .from("order_assignments")
    .select(
      "id, fason_partner_id, status, assigned_at, estimated_delivery, in_production_at, ready_at, shipped_at, notes"
    )
    .eq("order_id", order.id)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  type AsgRow = {
    id: string;
    fason_partner_id: string;
    status: string;
    assigned_at: string;
    estimated_delivery: string | null;
    in_production_at: string | null;
    ready_at: string | null;
    shipped_at: string | null;
    notes: string | null;
  };
  const assignment = asgRow as AsgRow | null;
  if (!assignment || assignment.fason_partner_id !== partnerId) {
    return NextResponse.json(
      { error: "not_your_order" },
      { status: 403 }
    );
  }

  // 4) Items
  const { data: itemsRaw } = await admin
    .from("order_items")
    .select(
      "id, product, title, config, width, height, qty, meta, proof_status, proof_approved_at, partner_decided_by, partner_decided_at, partner_decision_note"
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
    meta: Record<string, unknown> | null;
    proof_status: string;
    proof_approved_at: string | null;
    partner_decided_by: string | null;
    partner_decided_at: string | null;
    partner_decision_note: string | null;
  };
  const items = (itemsRaw as ItemRow[] | null) ?? [];
  const itemIds = items.map((i) => i.id);

  // 5) Designs (per item, latest version, non-superseded)
  type DesignRow = {
    id: string;
    order_item_id: string;
    original_name: string;
    mime_type: string;
    version: number;
    status: string;
    revised_by_partner_id: string | null;
  };
  type CutlineRow = {
    id: string;
    design_file_id: string | null;
    preview_png_url: string | null;
    tier: string | null;
    mode: string | null;
    offset_mm: number | null;
  };

  const designsByItem = new Map<string, DesignRow[]>();
  const cutlineByDesign = new Map<string, CutlineRow>();

  if (itemIds.length > 0) {
    const { data: dfRaw } = await admin
      .from("design_files")
      .select(
        "id, order_item_id, original_name, mime_type, version, status, revised_by_partner_id"
      )
      .in("order_item_id", itemIds)
      .neq("status", "superseded")
      .order("version", { ascending: true });
    for (const d of ((dfRaw as DesignRow[] | null) ?? [])) {
      const arr = designsByItem.get(d.order_item_id) ?? [];
      arr.push(d);
      designsByItem.set(d.order_item_id, arr);
    }

    const designIds = (dfRaw as DesignRow[] | null)?.map((d) => d.id) ?? [];
    if (designIds.length > 0) {
      const { data: clRaw } = await admin
        .from("cutline_designs")
        .select(
          "id, design_file_id, preview_png_url, tier, mode, offset_mm"
        )
        .in("design_file_id", designIds)
        .neq("status", "superseded")
        .order("created_at", { ascending: false });
      for (const c of ((clRaw as CutlineRow[] | null) ?? [])) {
        if (c.design_file_id && !cutlineByDesign.has(c.design_file_id)) {
          cutlineByDesign.set(c.design_file_id, c);
        }
      }
    }
  }

  // 6) Item JSON shape + PII redacted address
  const itemsJson = items.map((it) => {
    const designs = (designsByItem.get(it.id) ?? []).map((df) => ({
      design_file_id: df.id,
      file_name: df.original_name,
      mime_type: df.mime_type,
      version: df.version,
      design_status: df.status,
      revised_by_partner: df.revised_by_partner_id !== null,
      cutline: cutlineByDesign.get(df.id) ?? null,
    }));
    return {
      id: it.id,
      product: it.product,
      title: it.title,
      config: it.config,
      width: it.width,
      height: it.height,
      qty: it.qty,
      meta: it.meta,
      proof_status: it.proof_status,
      proof_approved_at: it.proof_approved_at,
      partner_decision: it.partner_decided_at
        ? {
            decided_at: it.partner_decided_at,
            note: it.partner_decision_note,
          }
        : null,
      designs,
    };
  });

  // 7) Adres redaction — sadece şehir/ilçe (kargo hazırlık için)
  const addr = order.address ?? {};
  type Addr = { city?: string; district?: string };
  const addrSafe = addr as Addr;
  const addressRedacted = {
    city: addrSafe.city ?? null,
    district: addrSafe.district ?? null,
  };

  // 8) Partner karar özeti
  const partnerDecisions = {
    approved: items.filter((i) => i.proof_status === "partner_approved").length,
    rejected: items.filter((i) => i.proof_status === "partner_rejected").length,
    revised: items.filter((i) => i.proof_status === "partner_revised").length,
    pending: items.filter(
      (i) =>
        i.proof_status === "approved" ||
        i.proof_status === "partner_review"
    ).length,
  };

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      created_at: order.created_at,
      estimated_delivery: order.estimated_delivery,
      address: addressRedacted,
    },
    assignment: {
      id: assignment.id,
      status: assignment.status,
      assigned_at: assignment.assigned_at,
      estimated_delivery: assignment.estimated_delivery,
      in_production_at: assignment.in_production_at,
      ready_at: assignment.ready_at,
      shipped_at: assignment.shipped_at,
      notes: assignment.notes,
    },
    items: itemsJson,
    partner_decisions: partnerDecisions,
  });
}
