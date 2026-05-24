/**
 * POST /api/orders/[id]/proof/[itemId]/view
 *
 * Sefa 19 May v68 (Migration 059):
 * Müşteri item'ı önizleme listesinden ilk tıkladığında çağrılır.
 * proof_status: pending → viewed (idempotent — approved/edited dokunulmaz)
 *
 * Bu endpoint istatistik içindir; hatalı çalışmasa bile akış kırılmaz.
 * Hatalar 200 OK ile silent log edilir.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
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

  // Auth: order sahipliği
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (orderRow.status !== "proof_pending") {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "not_in_proof_pending" },
      { status: 200 }
    );
  }

  // Sadece pending → viewed; başka state'lere dokunma
  const { error: updErr } = await admin
    .from("order_items")
    .update({
      proof_status: "viewed",
      proof_viewed_at: new Date().toISOString(),
    } satisfies TablesUpdate<"order_items">)
    .eq("id", itemId)
    .eq("order_id", orderId)
    .eq("proof_status", "pending");

  if (updErr) {
    console.error("[proof/view] update error:", updErr);
    return NextResponse.json(
      { ok: false, error: "İşaretlenemedi" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
