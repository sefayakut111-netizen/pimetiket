/**
 * GET /api/me/pending-approval-requests
 * Panelim rozeti — bekleyen onay görseli sayısı + ilk sipariş linki.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orderRows } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", user.id);

  const orderIds = (orderRows ?? []).map((r) => (r as { id: string }).id);
  if (orderIds.length === 0) {
    return NextResponse.json({ ok: true, count: 0, order_id: null });
  }

  const { data: pendingRows, error } = await admin
    .from("approval_requests")
    .select("id, order_id, created_at")
    .in("order_id", orderIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pending-approval-requests] query failed:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const rows = (pendingRows ?? []) as { id: string; order_id: string }[];
  const count = rows.length;
  const order_id = count > 0 ? rows[0].order_id : null;

  return NextResponse.json({ ok: true, count, order_id });
}
