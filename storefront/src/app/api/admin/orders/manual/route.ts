/**
 * /api/admin/orders/manual — Manuel sipariş oluştur.
 *
 * /admin/siparis-ekle formu kullanır. fn_create_manual_order RPC'sini
 * çağırır (atomik sipariş + items + event).
 *
 * Manuel sipariş özelliği:
 *   - user_id = null (hiçbir hesaba bağlı değil)
 *   - is_manual = true
 *   - status = "paid" (ödeme zaten alındığı varsayılır)
 *
 * Auth: admin/staff role gerekli.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { withAdminTestOrderMarker } from "@/lib/admin-test-order";

interface ManualOrderItem {
  product: "etiket" | "sticker";
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  meta?: Record<string, unknown>;
}

interface ManualOrderBody {
  subtotal: number;
  shipping: number;
  total: number;
  address: {
    name: string;
    phone: string;
    addr: string;
    city: string;
    label?: string;
    email?: string;
  };
  invoice: {
    type: "individual" | "corporate";
    tc?: string;
    vkn?: string;
    companyName?: string;
    taxOffice?: string;
  };
  payment: {
    method: "card" | "transfer";
    masked?: string;
  };
  estimatedDelivery: string | null;
  items: ManualOrderItem[];
  discount?: {
    type: string;
    value: number;
    amount: number;
    reason?: string;
  };
  coupon?: {
    code: string;
    discount: number;
    kind: string;
  };
  customerUserId?: string;
}

// Sefa kuralı (12 May): orderId 8-char nanoid — tek kaynak
// src/lib/customer-order.ts. Duplicate logic kaldırıldı.
import { generateOrderId } from "@/lib/customer-order";

export async function POST(req: Request) {
  // Auth — audit P0 (4-agent 15 May): inline RBAC kaldırıldı, ortak
  // assertAdmin() helper'ı kullanılıyor (Cookie-based session, service_role
  // header'da DEĞİL).
  const auth = await assertPermission("manual_order", "create");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Body validate
  let body: ManualOrderBody;
  try {
    body = (await req.json()) as ManualOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.address?.name ||
    !body.address?.phone ||
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return NextResponse.json(
      { error: "Eksik alan: ad, telefon veya ürün" },
      { status: 400 }
    );
  }

  // Service role ile RPC çağır
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orderId = generateOrderId();

  const paymentPayload = withAdminTestOrderMarker({
    ...body.payment,
    ...(body.discount && body.discount.amount > 0
      ? { manualDiscount: body.discount }
      : {}),
    ...(body.coupon
      ? {
          coupon: {
            code: body.coupon.code,
            discount: body.coupon.discount,
            kind: body.coupon.kind,
          },
        }
      : {}),
  });

  const { error: rpcErr } = await admin.rpc(
    "fn_create_manual_order",
    {
      p_order_id: orderId,
      p_subtotal: body.subtotal,
      p_shipping: body.shipping,
      p_total: body.total,
      p_address: body.address,
      p_invoice: body.invoice,
      p_payment: paymentPayload,
      p_estimated_delivery: body.estimatedDelivery,
      p_items: body.items,
    }
  );
  if (rpcErr) {
    console.error("[admin/manual] rpc error:", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message ?? "Sipariş oluşturulamadı" },
      { status: 500 }
    );
  }

  if (body.coupon?.code && body.coupon.discount > 0) {
    const { data: couponRow } = await admin
      .from("coupons")
      .select("id")
      .eq("code", body.coupon.code.toUpperCase())
      .maybeSingle();
    if (couponRow?.id) {
      const couponUserId = body.customerUserId ?? auth.user.id;
      const { error: useErr } = await admin.from("coupon_uses").insert({
        coupon_id: couponRow.id,
        order_id: orderId,
        user_id: couponUserId,
        discount_amount: body.coupon.discount,
      });
      if (useErr) {
        console.error("[admin/manual] coupon_uses insert:", useErr);
      }
    }
  }

  // order_events için aktör admin
  await admin
    .from("order_events")
    .update({ actor_id: auth.user.id })
    .eq("order_id", orderId)
    .eq("event_type", "order_created_manual");

  return NextResponse.json({ ok: true, orderId });
}
