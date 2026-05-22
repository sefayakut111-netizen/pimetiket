/**
 * GET /api/orders/[id]/help-requests
 *
 * Sefa 22 May v68 (Faz 4b — Uzman akışı, müşteri tarafı):
 * /onay sayfasında müşterinin tüm yardım ticket'larını (resolved dahil) listele.
 * fn_proof_summary sadece 'open' + 'in_progress' döndürür; bu endpoint
 * resolved/dismissed olanları da getirir → müşteri operatörün cevabını görür.
 *
 * Auth: sipariş sahibi.
 *
 * Response:
 *   { items: Array<{
 *       id, itemId, message, status, createdAt, resolvedAt, resolutionNote
 *     }> }
 *
 * Default: son 30 günün tüm ticket'ları (status farkı yok).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
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
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if ((order as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Son 30 gün — eski ticket'lar görünmesin (gürültü olur)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: rows, error } = await admin
    .from("proof_help_requests")
    .select(
      "id, order_item_id, message, status, created_at, resolved_at, resolution_note"
    )
    .eq("order_id", orderId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[orders/help-requests] query error:", error);
    return NextResponse.json(
      { error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  type Row = {
    id: string;
    order_item_id: string;
    message: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
  };
  const items = ((rows as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    itemId: r.order_item_id,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolutionNote: r.resolution_note,
  }));

  return NextResponse.json({ items });
}
