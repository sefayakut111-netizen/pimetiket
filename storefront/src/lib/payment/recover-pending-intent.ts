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
import { ensureOrderDesignsPromoted } from "@/lib/storage/promote-temp-designs";
import { buildOrderItemMeta } from "@/lib/order-item-meta";
import {
  sendOrderConfirmation,
  sendOrderProofRequiredIfEligible,
} from "@/lib/mail/notifications";
import { enqueueMail } from "@/lib/mail/enqueue";
import { queryPaymentStatus } from "@/lib/payment/paytr";
import { resolveOrderIdFromIntent } from "@/lib/payment/resolve-order-from-intent";
import { withAdminTestOrderMarker } from "@/lib/admin-test-order";
import { isAdminOrStaffUserId } from "@/lib/supabase/assert-admin";
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
    couponDiscount?: number | null;
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

async function runPostFinalizeSideEffects(
  admin: AdminClient,
  intent: IntentRow,
  orderId: string
): Promise<void> {
  await ensureOrderDesignsPromoted({
    admin,
    orderId,
    userId: intent.user_id,
  });

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

  void sendOrderProofRequiredIfEligible({
    userId: intent.user_id,
    orderId,
  }).catch((err) =>
    console.error("[payment/recover] proof_required mail failed:", err)
  );

  void import("@/lib/mail/notifications").then(({ sendAdminNewOrder }) =>
    sendAdminNewOrder({ orderId, userId: intent.user_id }).catch((err) =>
      console.error("[payment/recover] admin notify failed:", err)
    )
  );
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
      .update({
        status: "needs_review",
        failure_reason: `amount_mismatch:${expectedKurus}!=${opts.totalAmountKurus}`,
      })
      .eq("id", intent.id);
    Sentry.captureMessage("payment_amount_mismatch_orphan_risk", {
      level: "error",
      tags: { merchantOid: intent.id },
      extra: {
        expectedKurus,
        incoming: opts.totalAmountKurus,
      },
    });
    const { notifyAdminCriticalAlert } = await import(
      "@/lib/mail/admin-critical-alert"
    );
    void notifyAdminCriticalAlert({
      alertKey: `amount_mismatch:${intent.id}`,
      subject: `🚨 PayTR tutar uyumsuzluğu (recover) — ${intent.id}`,
      title: "orphaned charge riski",
      body: `expected:${expectedKurus} incoming:${opts.totalAmountKurus}`,
      targetType: "cart",
      targetId: intent.id,
      extra: {
        admin_link: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"}/admin/finans?tab=odemeler`,
      },
    }).catch(() => {});
    return { status: "failed", reason: "needs_review" };
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

  const { estimatedDeliveryIsoForItems } = await import(
    "@/lib/site-settings-server"
  );
  const estimatedDelivery = await estimatedDeliveryIsoForItems(
    intent.snapshot.items
  );
  const markAdminTestOrder = await isAdminOrStaffUserId(intent.user_id);
  const paymentMeta = withAdminTestOrderMarker(
    {
      method: "card",
      masked: "**** **** **** ****",
      installment: opts.installmentCount ?? 1,
      provider: "paytr",
      merchantOid: intent.id,
      source: opts.source,
      recovered_at: new Date().toISOString(),
    },
    markAdminTestOrder
  );

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
    await ensureOrderDesignsPromoted({
      admin,
      orderId,
      userId: intent.user_id,
    });
    return { status: "consumed", orderId };
  }

  if (intent.snapshot.couponCode) {
    const { applyCouponAfterOrder } = await import("@/lib/payment/coupon-server");
    await applyCouponAfterOrder(admin, {
      code: intent.snapshot.couponCode,
      subtotal: intent.snapshot.subtotal,
      userId: intent.user_id,
      orderId,
      chargedDiscount: intent.snapshot.couponDiscount ?? undefined,
      paymentIntentId: intent.id,
    });
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
      await ensureOrderDesignsPromoted({
        admin,
        orderId,
        userId: intent.user_id,
      });
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

  if (intent.status === "needs_review") {
    return {
      status: "failed",
      reason: intent.failure_reason ?? "needs_review",
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
    const totalKurus =
      queryResult.paymentTotalKurus ?? queryResult.paymentAmountKurus ?? 0;
    if (totalKurus === 0) {
      Sentry.captureMessage(
        "PayTR durum sorgusu tutar dönmedi — finalize atlandı, IPN bekleniyor",
        {
          level: "warning",
          tags: { scope: "payment.recover.amount", merchant_oid: merchantOid },
        }
      );
      return { status: "pending" };
    }
    return finalizeFromPaytrSuccess(admin, intent, {
      totalAmountKurus: totalKurus,
      installmentCount: queryResult.installmentCount,
      source: "paytr_status_query",
    });
  }

  return { status: "pending" };
}
