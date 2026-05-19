/**
 * POST /api/payment/refund
 *
 * Admin tarafı refund. PayTR /odeme/iade endpoint'ini çağırır.
 *
 * Body:
 *   { orderId, amount?, reason?, returnId? }
 *
 * NOT: PayTR refund 30 gün içinde yapılabilir (banka kuralı).
 * Daha eskiyse manuel banka transferi gerekir.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refundPayment, isPayTrConfigured } from "@/lib/payment/paytr";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

const RefundBodySchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
  returnId: z.string().uuid().optional(),
});

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
  // Admin/staff guard — cookie-based session (12 May P0 audit fix):
  // önceden x-admin-secret header'da service_role taşınıyordu; logs/proxy/
  // shell history'den sızma riski vardı. Şu an sadece auth.users + profiles.role
  // üzerinden RBAC kontrolü yapılıyor.
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isPayTrConfigured()) {
    return NextResponse.json(
      { error: "payment_provider_not_configured" },
      { status: 503 }
    );
  }

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

  // Başarılı charge'ı bul (PayTR'de psp_transaction_id = merchant_oid)
  const admin = createAdminClient();
  const { data: charges, error: chargeErr } = await admin
    .from("payments")
    .select("*")
    .eq("order_id", body.orderId)
    .eq("action", "charge")
    .eq("status", "success")
    .eq("psp_provider", "paytr")
    .order("created_at", { ascending: false })
    .limit(1);

  if (chargeErr) {
    console.error("[payment/refund] charge lookup error:", chargeErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const charge = (charges as unknown as PaymentRow[])?.[0];
  if (!charge) {
    return NextResponse.json(
      { error: "no_charge_to_refund" },
      { status: 404 }
    );
  }

  // Refund tutarı
  const refundAmount = body.amount ?? charge.amount;
  if (refundAmount > charge.amount) {
    return NextResponse.json(
      { error: "refund_exceeds_charge", chargeAmount: charge.amount },
      { status: 400 }
    );
  }

  // Daha önce yapılmış iade var mı?
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

  // Sefa 20 May v68 (Mig 069): race condition guard.
  // PayTR refund call'dan ÖNCE INSERT placeholder (status='processing').
  // Partial unique index aynı anda 2. paralel insert'i fail eder
  // → çift PayTR call önlenir. Sonra PayTR çağrılır, status update.
  const isPartial = refundAmount < charge.amount;
  const action = isPartial ? "partial_refund" : "refund";

  const { data: placeholderRow, error: phErr } = await admin
    .from("payments")
    .insert([
      {
        order_id: body.orderId,
        psp_provider: "paytr",
        psp_transaction_id: charge.psp_transaction_id,
        action,
        amount: refundAmount,
        currency: "TRY",
        status: "processing", // Mig 069: PayTR call sonuçlanana kadar lock
        idempotency_key: `refund:${body.orderId}:${Date.now()}`,
        psp_raw: { refund_amount: refundAmount, reason: body.reason } as never,
      },
    ] as never)
    .select("id")
    .single();

  if (phErr) {
    // Unique constraint violation (23505) → başka refund zaten in-progress
    const code = (phErr as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json(
        {
          error: "refund_already_in_progress",
          hint: "Bu sipariş için başka bir iade işlemi şu an çalışıyor (veya tamamlandı). Birkaç saniye sonra kontrol et.",
        },
        { status: 409 }
      );
    }
    console.error("[payment/refund] placeholder insert error:", phErr);
    return NextResponse.json(
      { error: "placeholder_insert_failed", detail: phErr.message },
      { status: 500 }
    );
  }

  const placeholderId = (placeholderRow as { id: string }).id;

  // PayTR refund (artık DB seviyesinde lock alındı)
  const result = await refundPayment({
    merchantOid: charge.psp_transaction_id,
    returnAmountTL: refundAmount,
  });

  if (!result.ok) {
    // PayTR reject → placeholder'ı 'failed' yap (sonradan tekrar denenebilir)
    await admin
      .from("payments")
      .update({
        status: "failed",
        psp_raw: {
          ...{ refund_amount: refundAmount, reason: body.reason },
          paytr_error: { reason: result.reason, code: result.errCode },
        } as never,
      } as never)
      .eq("id", placeholderId);
    console.error("[payment/refund] PayTR refund failed:", result);
    return NextResponse.json(
      {
        error: "paytr_refund_rejected",
        reason: result.reason,
        code: result.errCode,
      },
      { status: 400 }
    );
  }

  // PayTR success → placeholder'ı 'success' yap
  const { data: refundRow, error: insertErr } = await admin
    .from("payments")
    .update({
      status: "success",
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", placeholderId)
    .select("*")
    .single();

  if (insertErr) {
    console.error("[payment/refund] payments update error:", insertErr);
    return NextResponse.json(
      {
        error: "paytr_ok_but_db_failed",
        warning:
          "PayTR'de iade yapıldı ama DB kaydı 'processing'de takıldı — manuel kontrol",
      },
      { status: 500 }
    );
  }

  // returns.refund_payment_id bağla (varsa)
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

  // order_events log
  await admin.from("order_events").insert([
    {
      order_id: body.orderId,
      event_type: "refunded",
      status_after: null,
      actor_id: auth.user.id,
      actor_role: auth.role,
      summary: isPartial
        ? `${refundAmount.toFixed(2)} TL kısmi iade yapıldı (PayTR).`
        : `Tam iade yapıldı (${refundAmount.toFixed(2)} TL, PayTR).`,
      detail: {
        refundAmount,
        reason: body.reason ?? null,
        provider: "paytr",
        merchantOid: charge.psp_transaction_id,
        actorEmail: auth.user.email ?? null,
      },
    },
  ] as never);

  return NextResponse.json({
    ok: true,
    refundAmount,
    action,
    provider: "paytr",
  });
}
