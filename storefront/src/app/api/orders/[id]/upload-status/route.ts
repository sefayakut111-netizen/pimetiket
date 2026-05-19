/**
 * GET /api/orders/[id]/upload-status
 *
 * /siparis/[id]/tasarim-yukle sayfası için minimal order özeti.
 * Her order_item için "design_files'ta kullanılabilir kayıt var mı?"
 * sorusunu yanıtlar (Mig 061 fn_order_has_design ile aynı statü kümesi).
 *
 * Auth: müşteri kendi siparişini sorgulayabilir.
 *
 * Response:
 *   {
 *     id: string,
 *     status: OrderStatus,
 *     items: Array<{ id, title, qty, width, height, hasDesign }>
 *   }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const USABLE_DESIGN_STATUSES = [
  "uploaded",
  "qc_running",
  "qc_warned",
  "qc_passed",
  "approved",
] as const;

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
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as
    | { id: string; user_id: string; status: string }
    | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Item'ları çek
  const { data: items } = await admin
    .from("order_items")
    .select("id, title, qty, width, height")
    .eq("order_id", orderId);
  const itemRows =
    (items as Array<{
      id: string;
      title: string;
      qty: number;
      width: number;
      height: number;
    }> | null) ?? [];

  // Her item için design_files var mı? — Tek sorgu, ardından map
  const { data: dfs } = await admin
    .from("design_files")
    .select("order_item_id")
    .eq("order_id", orderId)
    .in("status", USABLE_DESIGN_STATUSES as unknown as string[]);
  const itemsWithDesign = new Set(
    ((dfs as Array<{ order_item_id: string | null }> | null) ?? [])
      .map((d) => d.order_item_id)
      .filter((id): id is string => typeof id === "string")
  );

  return NextResponse.json({
    id: orderRow.id,
    status: orderRow.status,
    items: itemRows.map((it) => ({
      id: it.id,
      title: it.title,
      qty: it.qty,
      width: it.width,
      height: it.height,
      hasDesign: itemsWithDesign.has(it.id),
    })),
  });
}
