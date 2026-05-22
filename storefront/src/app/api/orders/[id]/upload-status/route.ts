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
  "analyzing",
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

  // Item'lari cek — meta'dan designCount al (multi-design destek)
  const { data: items } = await admin
    .from("order_items")
    .select("id, title, qty, width, height, meta")
    .eq("order_id", orderId);
  const itemRows =
    (items as Array<{
      id: string;
      title: string;
      qty: number;
      width: number;
      height: number;
      meta: { designCount?: number } | null;
    }> | null) ?? [];

  // Her item icin design_files SAYISI (multi-design icin)
  // Sefa 22 May v68 — onceki kod sadece "var mi" bool donduruyordu;
  // simdi N tasarim slot'u icin "kac yuklendi / kac gerekli" rapor.
  const { data: dfs } = await admin
    .from("design_files")
    .select("order_item_id")
    .eq("order_id", orderId)
    .in("status", USABLE_DESIGN_STATUSES as unknown as string[]);
  const designCountByItem = new Map<string, number>();
  for (const d of ((dfs as Array<{ order_item_id: string | null }> | null) ??
    [])) {
    if (typeof d.order_item_id === "string") {
      designCountByItem.set(
        d.order_item_id,
        (designCountByItem.get(d.order_item_id) ?? 0) + 1
      );
    }
  }

  return NextResponse.json({
    id: orderRow.id,
    status: orderRow.status,
    items: itemRows.map((it) => {
      const designsRequired = Math.max(1, it.meta?.designCount ?? 1);
      const designsUploaded = designCountByItem.get(it.id) ?? 0;
      return {
        id: it.id,
        title: it.title,
        qty: it.qty,
        width: it.width,
        height: it.height,
        // Eski API uyumu — boolean: en az 1 tasarim varsa true
        hasDesign: designsUploaded > 0,
        // Multi-design destek (Sefa 22 May v68)
        designsRequired,
        designsUploaded,
        designsComplete: designsUploaded >= designsRequired,
      };
    }),
  });
}
