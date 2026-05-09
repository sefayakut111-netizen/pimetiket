/**
 * POST /api/payment/refund
 *
 * Admin tarafı (service_role gerekir). Sipariş veya iade üzerinden
 * tetiklenir.
 *
 * Body:
 *   { orderId: string, amount?: number, reason?: string,
 *     returnId?: string }
 *
 * Akış:
 *   1. Auth check + admin role check (TODO: P1 staff RBAC; şimdilik
 *      service_role secret header kontrolü ile)
 *   2. payments tablosundan başarılı charge'ı bul (order_id ile)
 *   3. iyzico refundPayment çağır
 *   4. payments tablosuna refund kaydı INSERT
 *   5. (Opsiyonel) returns.refund_payment_id bağla
 *   6. order_events: 'refunded' event log
 *
 * Tutar opsiyonel — verilmezse full refund (charge.amount).
 *
 * GÜVENLIK: bu endpoint internal — UI'dan direkt çağrılmaz, admin
 * panelinden çağrılır + service_role check yapılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refundPayment, isIyzicoConfigured } from "@/lib/payment/iyzico";
import { createAdminClient } from "@/lib/supabase/admin";

const RefundBodySchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
  returnId: z.string().uuid().optional(),
});

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

interface PaymentRow {
  id: string;
  order_id: string;
  psp_provider: string;
  psp_transaction_id: string | null;
  action: string;
  amount: number;
  currency: string;
  status: string;
}

export async function POST(req: NextRequest) {
  // 1) Admin guard — header'da SUPABASE_SERVICE_ROLE_KEY ile match
  // (geçici çözüm; staff RBAC P1'de gelecek)
  const adminSecret = req.headers.get("x-admin-secret");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || adminSecret !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2) Iyzico configured?
  if (!isIyzicoConfigured()) {
    return NextResponse.json(
      { error: "payment_provider_not_configured" },
      { status: 503 }
    );
  }

  // 3) Body validate
  let body: z.infer<typeof RefundBodySchema>;
  try {
    body = RefundBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_body",
        detail: err instanceof Error ? err.message : "validation_failed",
      },
      { status: 400 }
    );
  }

  // 4) Başarılı charge'ı bul
  const admin = createAdminClient();
  const { data: charges, error: chargeErr } = await admin
    .from("payments")
    .select("*")
    .eq("order_id", body.orderId)
    .eq("action", "charge")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1);

  if (chargeErr) {
    console.error("[payment/refund] charge lookup error:", chargeErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const charge = (charges as unknown as PaymentRow[])?.[0];
  if (!charge) {
    return NextResponse.json({ error: "no_charge_to_refund" }, { status: 404 });
  }

  // 5) Refund tutarı (default: tam tutar)
  const refundAmount = body.amount ?? charge.amount;
  if (refundAmount > charge.amount) {
    return NextResponse.json(
      { error: "refund_exceeds_charge", chargeAmount: charge.amount },
      { status: 400 }
    );
  }

  // 6) Daha önce iade yapıldı mı? (toplam refund + bu request > charge?)
  const { data: existingRefunds } = await admin
    .from("payments")
    .select("amount")
    .eq("order_id", body.orderId)
    .in("action", ["refund", "partial_refund"])
    .eq("status", "success");
  const refundedSoFar = (
    (existingRefunds as unknown as { amount: number }[]) ?? []
  ).reduce((s, r) => s + Number(r.amount), 0);
  if (refundedSoFar + refundAmount > charge.amount) {
    return NextResponse.json(
      {
        error: "refund_total_exceeds_charge",
        refundedSoFar,
        remaining: charge.amount - refundedSoFar,
      },
      { status: 400 }
    );
  }

  if (!charge.psp_transaction_id) {
    return NextResponse.json(
      { error: "missing_psp_transaction_id" },
      { status: 500 }
    );
  }

  // 7) iyzico refund çağır
  let result;
  try {
    result = await refundPayment({
      locale: "tr",
      conversationId: `refund:${body.orderId}:${Date.now()}`,
      paymentTransactionId: charge.psp_transaction_id,
      price: refundAmount.toFixed(2),
      ip: getClientIp(req),
      currency: "TRY",
    });
  } catch (err) {
    console.error("[payment/refund] iyzico error:", err);
    return NextResponse.json({ error: "iyzico_refund_failed" }, { status: 502 });
  }

  if (result.status !== "success") {
    console.error("[payment/refund] iyzico fail:", result.errorMessage);
    return NextResponse.json(
      {
        error: "iyzico_refund_rejected",
        code: result.errorCode,
        message: result.errorMessage,
      },
      { status: 400 }
    );
  }

  // 8) payments INSERT (refund kaydı)
  const isPartial = refundAmount < charge.amount;
  const action = isPartial ? "partial_refund" : "refund";
  const { data: refundRow, error: insertErr } = await admin
    .from("payments")
    .insert([
      {
        order_id: body.orderId,
        psp_provider: "iyzico",
        psp_transaction_id: result.paymentTransactionId,
        action,
        amount: refundAmount,
        currency: "TRY",
        status: "success",
        idempotency_key: `refund:${body.orderId}:${result.paymentTransactionId}`,
        psp_raw: result as never,
        completed_at: new Date().toISOString(),
      },
    ] as never)
    .select("*")
    .single();

  if (insertErr) {
    console.error("[payment/refund] payments insert error:", insertErr);
    // iyzico iade yaptı ama DB log düşmedi — manuel düzeltilmeli
    return NextResponse.json(
      {
        error: "iyzico_ok_but_db_failed",
        warning: "iyzico'da iade yapıldı ama DB kaydı düşmedi, manuel kontrol gerek",
        iyzicoTransactionId: result.paymentTransactionId,
      },
      { status: 500 }
    );
  }

  // 9) returns.refund_payment_id bağla (varsa)
  if (body.returnId && refundRow) {
    await admin
      .from("returns")
      .update({
        refund_payment_id: (refundRow as { id: string }).id,
        refund_amount: refundAmount,
        status: "refunded",
      } as never)
      .eq("id", body.returnId);
  }

  // 10) order_events log
  await admin.from("order_events").insert([
    {
      order_id: body.orderId,
      event_type: "refunded",
      status_after: null,
      actor_role: "admin",
      summary: isPartial
        ? `${refundAmount.toFixed(2)} TL kısmi iade yapıldı.`
        : `Tam iade yapıldı (${refundAmount.toFixed(2)} TL).`,
      detail: {
        refundAmount,
        reason: body.reason ?? null,
        iyzicoPaymentTransactionId: result.paymentTransactionId,
      },
    },
  ] as never);

  return NextResponse.json({
    ok: true,
    refundAmount,
    action,
    paymentTransactionId: result.paymentTransactionId,
  });
}
