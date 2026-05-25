/**
 * POST /api/orders/[id]/cancel
 *
 * Müşteri kendi siparişini iptal eder (paid / awaiting_upload).
 * PayTR charge varsa tam iade tetiklenir.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPayTrConfigured, refundPayment } from "@/lib/payment/paytr";
import type { Json, TablesInsert } from "@/lib/supabase/types";

const CANCELLABLE = new Set(["paid", "awaiting_upload"]);

interface PaymentRow {
  id: string;
  psp_transaction_id: string | null;
  amount: number;
}

export async function POST(
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

  const { data: orderRow, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, status, total")
    .eq("id", orderId)
    .single();

  if (orderErr || !orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const order = orderRow as {
    id: string;
    user_id: string;
    status: string;
    total: number;
  };

  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "Bu sipariş sana ait değil" }, { status: 403 });
  }

  if (!CANCELLABLE.has(order.status)) {
    return NextResponse.json(
      { error: `Bu durumda iptal edilemez (${order.status})` },
      { status: 400 }
    );
  }

  let refundAmount: number | null = null;

  if (isPayTrConfigured()) {
    const { data: charges } = await admin
      .from("payments")
      .select("id, psp_transaction_id, amount")
      .eq("order_id", orderId)
      .eq("action", "charge")
      .eq("status", "success")
      .eq("psp_provider", "paytr")
      .order("created_at", { ascending: false })
      .limit(1);

    const charge = (charges as PaymentRow[] | null)?.[0];

    if (charge?.psp_transaction_id) {
      const { data: existingRefunds } = await admin
        .from("payments")
        .select("amount")
        .eq("order_id", orderId)
        .in("action", ["refund", "partial_refund"])
        .eq("status", "success");

      const refundedSoFar = (
        (existingRefunds as { amount: number }[] | null) ?? []
      ).reduce((s, r) => s + Number(r.amount), 0);

      const remaining = charge.amount - refundedSoFar;
      if (remaining > 0) {
        const { data: placeholderRow, error: phErr } = await admin
          .from("payments")
          .insert([
            {
              order_id: orderId,
              psp_provider: "paytr",
              psp_transaction_id: charge.psp_transaction_id,
              action: "refund",
              amount: remaining,
              currency: "TRY",
              status: "processing",
              idempotency_key: `customer-cancel:${orderId}:${Date.now()}`,
              psp_raw: {
                refund_amount: remaining,
                reason: "customer_cancel",
              } satisfies Json,
            } satisfies TablesInsert<"payments">,
          ])
          .select("id")
          .single();

        if (phErr) {
          const code = (phErr as { code?: string }).code;
          if (code === "23505") {
            return NextResponse.json(
              { error: "refund_already_in_progress" },
              { status: 409 }
            );
          }
          console.error("[orders/cancel] refund placeholder failed:", phErr);
          return NextResponse.json({ error: "refund_init_failed" }, { status: 500 });
        }

        const placeholderId = (placeholderRow as { id: string }).id;
        const result = await refundPayment({
          merchantOid: charge.psp_transaction_id,
          returnAmountTL: remaining,
        });

        if (!result.ok) {
          await admin
            .from("payments")
            .update({
              status: "failed",
              psp_raw: {
                refund_amount: remaining,
                reason: "customer_cancel",
                paytr_error: { reason: result.reason, code: result.errCode },
              } satisfies Json,
            })
            .eq("id", placeholderId);
          return NextResponse.json(
            { error: "paytr_refund_rejected", reason: result.reason },
            { status: 400 }
          );
        }

        await admin
          .from("payments")
          .update({
            status: "success",
            completed_at: new Date().toISOString(),
          })
          .eq("id", placeholderId);

        refundAmount = remaining;
      }
    }
  }

  const { error: updateErr } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);

  if (updateErr) {
    console.error("[orders/cancel] status update failed:", updateErr);
    return NextResponse.json({ error: "Güncelleme başarısız" }, { status: 500 });
  }

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "order_cancelled",
      status_after: "cancelled",
      actor_id: user.id,
      actor_role: "customer",
      summary:
        refundAmount != null
          ? `Müşteri siparişi iptal etti — ${refundAmount.toFixed(2)} ₺ iade`
          : "Müşteri siparişi iptal etti",
      detail: {
        refundAmount,
        source: "customer_cancel",
      } satisfies Json,
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({ ok: true, refundAmount });
}
