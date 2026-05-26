/**
 * PayTR IPN miss recovery — pending intent'i PayTR Durum Sorgu ile doğrular
 * ve gerekirse fn_finalize_paid_order çalıştırır.
 *
 * Kullanım:
 *   - GET /api/payment/callback (browser dönüşü, IPN henüz gelmedi)
 *   - GET /api/payment/status (odeme-sonuc polling)
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderId } from "@/lib/customer-order";
import { promoteOrderDesigns } from "@/lib/storage/promote-temp-designs";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";
import { buildOrderItemMeta, orderItemHasDesigns } from "@/lib/order-item-meta";
import {
  sendOrderConfirmation,
  sendOrderProofRequired,
} from "@/lib/mail/notifications";
import { enqueueMail } from "@/lib/mail/enqueue";
import { queryPaymentStatus } from "@/lib/payment/paytr";
import { resolveOrderIdFromIntent } from "@/lib/payment/resolve-order-from-intent";
import type { Json } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;

interface IntentSnapshotItem {
  id: string;
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
}

interface IntentRow {
  id: string;
  user_id: string;
  card_amount: number;
  snapshot: {
    items: IntentSnapshotItem[];
    address: Record<string, unknown>;
    invoice: Record<string, unknown>;
    subtotal: number;
    shipping: number;
    total: number;
    couponCode: string | null;
  };
  status: string;
  order_id: string | null;
  failure_reason: string | null;
}

export type RecoverPendingResult =
  | { status: "consumed"; orderId: string }
  | { status: "failed"; reason: string }
  | { status: "pending" }
  | { status: "not_found" };

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function notifyAdminNewOrder({
  admin,
  orderId,
  userId,
}: {
  admin: AdminClient;
  orderId: string;
  userId: string;
}): Promise<void> {
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) return;

  type OrderRow = {
    total: number | string;
    address: { fullName?: string } | null;
    status: string;
    order_items: Array<{ product: string; qty: number; title: string }>;
  };
  const { data: orderData } = await admin
    .from("orders")
    .select("total, address, status, order_items(product, qty, title)")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as OrderRow | null;
  if (!order) return;

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const customerEmail = userData?.user?.email ?? "—";
  const addr = order.address ?? {};
  const items = order.order_items ?? [];
  const itemsSummary = items
    .map((i) => `${i.qty}× ${i.title} (${i.product})`)
    .join(" · ");
  const total = Number(order.total) || 0;
  const totalText = `${Math.round(total).toLocaleString("tr-TR")} ₺`;
  const hasDesign = (order.status as string) !== "awaiting_upload";

  for (const to of adminEmails) {
    await enqueueMail({
      to,
      templateKey: "admin_new_order",
      category: "admin",
      targetType: "order",
      targetId: orderId,
      payload: {
        order_id: orderId,
        customer_email: customerEmail,
        customer_name: addr.fullName ?? "Yeni müşteri",
        total_text: totalText,
        items_summary: itemsSummary || "—",
        has_design: hasDesign,
      },
    });
  }
}

async function runPostFinalizeSideEffects(
  admin: AdminClient,
  intent: IntentRow,
  orderId: string
): Promise<void> {
  const { data: insertedItems } = await admin
    .from("order_items")
    .select("id, product, meta")
    .eq("order_id", orderId);

  const orderItemsForPromote = (
    (insertedItems as unknown as Array<{
      id: string;
      product: "sticker" | "etiket";
      meta: Record<string, unknown>;
    }>) ?? []
  ).filter((i) => orderItemHasDesigns(i.meta));

  if (orderItemsForPromote.length > 0) {
    try {
      const promotedCount = await promoteOrderDesigns({
        admin,
        orderId,
        userId: intent.user_id,
        orderItems: orderItemsForPromote,
      });

      if (promotedCount > 0) {
        await admin
          .from("orders")
          .update({ status: "qc_pending" })
          .eq("id", orderId);

        scheduleOrderDesignQC(admin, orderId);
      }
    } catch (err) {
      console.error("[payment/recover] promote failed:", err);
    }
  }

  try {
    const { count: priorOrders } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", intent.user_id)
      .neq("id", orderId);
    if (priorOrders === 0 || priorOrders === null) {
      await admin.rpc("fn_complete_referral", {
        p_referred_user_id: intent.user_id,
      });
    }
  } catch (err) {
    console.error("[payment/recover] referral completion error:", err);
  }

  await admin.from("cart_items").delete().eq("user_id", intent.user_id);

  await admin
    .from("payment_intents")
    .update({ order_id: orderId })
    .eq("id", intent.id);

  void sendOrderConfirmation({
    userId: intent.user_id,
    orderId,
  }).catch((err) =>
    console.error("[payment/recover] order mail failed:", err)
  );

  void sendOrderProofRequired({
    userId: intent.user_id,
    orderId,
  }).catch((err) =>
    console.error("[payment/recover] proof_required mail failed:", err)
  );

  void notifyAdminNewOrder({
    admin,
    orderId,
    userId: intent.user_id,
  }).catch((err) => console.error("[payment/recover] admin notify failed:", err));
}

async function finalizeFromPaytrSuccess(
  admin: AdminClient,
  intent: IntentRow,
  opts: {
    totalAmountKurus: number;
    installmentCount?: number;
    source: string;
  }
): Promise<RecoverPendingResult> {
  const expectedKurus = Math.round(intent.card_amount * 100);
  if (Math.abs(expectedKurus - opts.totalAmountKurus) > 1) {
    await admin
      .from("payment_intents")
      .update({ status: "failed", failure_reason: "amount_mismatch" })
      .eq("id", intent.id);
    return { status: "failed", reason: "amount_mismatch" };
  }

  const itemsPayload = intent.snapshot.items.map((i) => ({
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: buildOrderItemMeta(i),
  }));

  const estimatedDelivery = addDaysIso(
    intent.snapshot.items.some((i) => i.product === "etiket") ? 10 : 5
  );
  const paymentMeta = {
    method: "card",
    masked: "**** **** **** ****",
    installment: opts.installmentCount ?? 1,
    provider: "paytr",
    merchantOid: intent.id,
    source: opts.source,
    recovered_at: new Date().toISOString(),
  };

  let candidateOrderId = generateOrderId();
  let rpcData: { order_id: string; was_duplicate: boolean }[] | null = null;
  let rpcErr: { message?: string; code?: string } | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: d, error: e } = await admin.rpc("fn_finalize_paid_order", {
      p_merchant_oid: intent.id,
      p_order_id: candidateOrderId,
      p_items: itemsPayload as Json,
      p_payment_meta: paymentMeta,
      p_estimated_delivery: estimatedDelivery,
    });
    rpcData = d;
    rpcErr = e as { message?: string; code?: string } | null;

    if (rpcErr && rpcErr.code === "23505" && attempt < 3) {
      candidateOrderId = generateOrderId();
      continue;
    }
    break;
  }

  if (rpcErr) {
    console.error("[payment/recover] finalize RPC error:", rpcErr);
    Sentry.captureException(rpcErr, {
      tags: { scope: "payment.recover.rpc", merchant_oid: intent.id },
    });
    await admin
      .from("payment_intents")
      .update({
        failure_reason: `RPC error: ${rpcErr.message ?? "unknown"}`,
      })
      .eq("id", intent.id);
    return { status: "pending" };
  }

  const rpcRow = rpcData?.[0];
  const orderId = rpcRow?.order_id ?? candidateOrderId;
  const wasDuplicate = rpcRow?.was_duplicate ?? false;

  if (wasDuplicate) {
    return { status: "consumed", orderId };
  }

  await runPostFinalizeSideEffects(admin, intent, orderId);
  return { status: "consumed", orderId };
}

/**
 * Pending intent için PayTR'den durum sorgular; başarılıysa siparişi açar.
 */
export async function recoverPendingPaymentIntent(
  admin: AdminClient,
  merchantOid: string,
  opts?: { userId?: string }
): Promise<RecoverPendingResult> {
  const { data: intentRow, error: intentErr } = await admin
    .from("payment_intents")
    .select("id, user_id, card_amount, snapshot, status, order_id, failure_reason")
    .eq("id", merchantOid)
    .maybeSingle();

  if (intentErr || !intentRow) {
    return { status: "not_found" };
  }

  const intent = intentRow as unknown as IntentRow;

  if (opts?.userId && intent.user_id !== opts.userId) {
    return { status: "not_found" };
  }

  if (intent.status === "consumed") {
    const orderId = await resolveOrderIdFromIntent(
      admin,
      merchantOid,
      intent.order_id
    );
    if (orderId) {
      return { status: "consumed", orderId };
    }
    return { status: "pending" };
  }

  if (intent.status === "failed") {
    return {
      status: "failed",
      reason: intent.failure_reason ?? "payment_failed",
    };
  }

  if (intent.status !== "pending") {
    return { status: "pending" };
  }

  const queryResult = await queryPaymentStatus(merchantOid);
  if (!queryResult.ok) {
    return { status: "pending" };
  }

  if (queryResult.status === "waiting") {
    return { status: "pending" };
  }

  if (queryResult.status === "failed") {
    await admin
      .from("payment_intents")
      .update({
        status: "failed",
        failure_reason:
          `[recover] ${queryResult.reason ?? "paytr_failed"}`.slice(0, 200),
      })
      .eq("id", merchantOid)
      .eq("status", "pending");
    return {
      status: "failed",
      reason: queryResult.reason ?? "payment_failed",
    };
  }

  if (queryResult.status === "success") {
    let totalKurus =
      queryResult.paymentTotalKurus ?? queryResult.paymentAmountKurus ?? 0;
    if (totalKurus === 0) {
      totalKurus = Math.round(intent.card_amount * 100);
    }
    return finalizeFromPaytrSuccess(admin, intent, {
      totalAmountKurus: totalKurus,
      installmentCount: queryResult.installmentCount,
      source: "paytr_status_query",
    });
  }

  return { status: "pending" };
}
