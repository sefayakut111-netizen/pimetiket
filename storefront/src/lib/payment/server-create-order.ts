import "server-only";

import type { Json } from "@/lib/supabase/types";
import type { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderId } from "@/lib/customer-order";
import { buildOrderItemMeta } from "@/lib/order-item-meta";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ServerCreateOrderPayload {
  userId: string;
  items: Array<{
    product: "sticker" | "etiket";
    title: string;
    config: string;
    width: number;
    height: number;
    qty: number;
    unit: number;
    total: number;
    meta?: Record<string, unknown>;
    designTempId?: string;
    shape?: string;
    cut?: string;
    softCorners?: boolean;
    material?: string;
    finish?: string;
    hediyeAdet?: number;
    materialId?: string;
    coatingId?: string;
    customizationId?: string;
    winding?: number;
  }>;
  address: {
    label?: string | null;
    name: string;
    addr: string;
    city: string;
    phone: string;
  };
  invoice: {
    type: "individual" | "corporate";
    tc?: string;
    vkn?: string;
    companyName?: string;
    taxOffice?: string;
  };
  payment: {
    method: string;
    masked?: string;
  };
  subtotal: number;
  shipping: number;
  total: number;
  estimatedDelivery?: string;
}

export async function createPaidOrderViaServiceRole(
  admin: AdminClient,
  payload: ServerCreateOrderPayload
): Promise<{ orderId: string } | { error: string }> {
  const orderId = generateOrderId();
  const itemsJson = payload.items.map((i) => ({
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: buildOrderItemMeta(i) as Json,
  }));

  const { error } = await admin.rpc("fn_create_order", {
    p_order_id: orderId,
    p_user_id: payload.userId,
    p_subtotal: payload.subtotal,
    p_shipping: payload.shipping,
    p_total: payload.total,
    p_address: payload.address as unknown as Json,
    p_invoice: payload.invoice as unknown as Json,
    p_payment: payload.payment as unknown as Json,
    p_estimated_delivery: payload.estimatedDelivery ?? "",
    p_items: itemsJson as Json,
  });

  if (error) {
    return { error: error.message ?? "order_create_failed" };
  }

  return { orderId };
}
