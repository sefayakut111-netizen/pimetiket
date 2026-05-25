/**
 * GET /api/payment/status?oid=PE...
 *
 * Ödeme sonrası polling — IPN gecikmesi veya miss durumunda intent durumunu
 * döner; pending ise PayTR Durum Sorgu ile recover dener.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPayTrConfigured } from "@/lib/payment/paytr";
import { recoverPendingPaymentIntent } from "@/lib/payment/recover-pending-intent";

export async function GET(req: NextRequest) {
  if (!isPayTrConfigured()) {
    return NextResponse.json(
      { error: "payment_provider_not_configured" },
      { status: 503 }
    );
  }

  const oid = req.nextUrl.searchParams.get("oid")?.trim();
  if (!oid) {
    return NextResponse.json({ error: "missing_oid" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await recoverPendingPaymentIntent(admin, oid, {
    userId: user.id,
  });

  if (result.status === "not_found") {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  if (result.status === "consumed") {
    return NextResponse.json({
      status: "consumed",
      orderId: result.orderId,
    });
  }

  if (result.status === "failed") {
    return NextResponse.json({
      status: "failed",
      reason: result.reason,
    });
  }

  return NextResponse.json({ status: "pending" });
}
