/**
 * GET /api/admin/orders/list
 *
 * Sefa 19 May v68 (admin dashboard fix):
 * Admin dashboard'unda tüm siparişleri listeler. Önceden `/admin/page.tsx`
 * `listCustomerOrders()` ile localStorage'dan veya kullanıcı bazlı dbList
 * ile çekiyordu — admin "kendi" siparişlerini görüyordu yalnızca. Bu
 * endpoint assertAdmin sonrası bütün orders + order_items'ı döner.
 *
 * Response shape `CustomerOrder[]` ile uyumlu (rowsToOrder mantığı burada
 * inline) — admin sayfasında kod değişikliği minimum kalır.
 *
 * Query parametreleri:
 *   - limit?: int (default 200, max 1000)
 *   - status?: comma separated order_status değerleri (filter)
 *
 * Auth: assertAdmin (super_admin / operations / production / customer_service)
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface DbOrderRow {
  id: string;
  user_id: string;
  status: string;
  subtotal: number | string;
  shipping: number | string;
  total: number | string;
  address: Record<string, unknown> | null;
  invoice: Record<string, unknown> | null;
  payment: Record<string, unknown> | null;
  estimated_delivery: string | null;
  created_at: string;
}

interface DbItemRow {
  id: string;
  order_id: string;
  product: "sticker" | "etiket";
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number | string;
  total: number | string;
  meta: Record<string, unknown> | null;
}

export async function GET(req: Request) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "200", 10), 1),
    1000
  );
  const statusFilter = url.searchParams.get("status");
  const statuses = statusFilter
    ? statusFilter
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const admin = createAdminClient();

  let orderQuery = admin
    .from("orders")
    .select(
      "id, user_id, status, subtotal, shipping, total, address, invoice, payment, estimated_delivery, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (statuses && statuses.length > 0) {
    orderQuery = orderQuery.in("status", statuses);
  }

  const { data: orderRows, error: orderErr } = await orderQuery;
  if (orderErr) {
    console.error("[admin/orders/list] order query error:", orderErr);
    return NextResponse.json(
      { error: "Siparişler alınamadı", detail: orderErr.message },
      { status: 500 }
    );
  }
  const orders = (orderRows ?? []) as unknown as DbOrderRow[];
  if (orders.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  // Items batch
  const orderIds = orders.map((o) => o.id);
  const { data: itemRows, error: itemErr } = await admin
    .from("order_items")
    .select(
      "id, order_id, product, title, config, width, height, qty, unit, total, meta"
    )
    .in("order_id", orderIds);
  if (itemErr) {
    console.error("[admin/orders/list] item query error:", itemErr);
    return NextResponse.json(
      { error: "Sipariş ürünleri alınamadı", detail: itemErr.message },
      { status: 500 }
    );
  }
  const items = (itemRows ?? []) as unknown as DbItemRow[];

  // CustomerOrder shape'ine map et (rowsToOrder inline)
  const result = orders.map((o) => {
    const ts = new Date(o.created_at).getTime();
    const orderItems = items
      .filter((i) => i.order_id === o.id)
      .map((i) => {
        const meta = (i.meta ?? {}) as Record<string, unknown>;
        return {
          id: i.id,
          product: i.product,
          title: i.title,
          config: i.config,
          width: i.width,
          height: i.height,
          qty: i.qty,
          unit: Number(i.unit),
          total: Number(i.total),
          shape: meta.shape,
          cut: meta.cut,
          softCorners: meta.softCorners,
          material: meta.material,
          finish: meta.finish,
          hediyeAdet: meta.hediyeAdet,
          materialId: meta.materialId,
          coatingId: meta.coatingId,
          customizationId: meta.customizationId,
          winding: meta.winding,
          addedAt: ts,
        };
      });
    return {
      id: o.id,
      status: o.status,
      items: orderItems,
      address: o.address,
      invoice: o.invoice,
      payment: o.payment,
      subtotal: Number(o.subtotal),
      shipping: Number(o.shipping),
      total: Number(o.total),
      createdAt: ts,
      createdAtIso: o.created_at,
      estimatedDelivery: o.estimated_delivery ?? undefined,
    };
  });

  return NextResponse.json({ orders: result });
}
