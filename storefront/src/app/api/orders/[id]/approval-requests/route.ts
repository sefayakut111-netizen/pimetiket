/**
 * GET /api/orders/[id]/approval-requests
 * Müşteri: kendi siparişinin onay görseli istekleri + signed URL'ler.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listApprovalRequestsForOrder } from "@/lib/approvals/list-approval-requests";

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
  const { data: orderRow } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as { id: string; user_id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const requests = await listApprovalRequestsForOrder(admin, orderId);
    return NextResponse.json({ ok: true, requests });
  } catch (err) {
    console.error("[approval-requests] list failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
