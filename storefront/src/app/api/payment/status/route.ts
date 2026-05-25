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
import { recoverPendingPaymentIntentWithRetries } from "@/lib/payment/recover-with-retries";

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
  const result = await recoverPendingPaymentIntentWithRetries(admin, oid, {
    userId: user.id,
    maxAttempts: 3,
    delayMs: 1200,
  });

  if (result.status === "not_found") {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  if (result.status === "consumed") {
    const { data: designFiles } = await admin
      .from("design_files")
      .select("id")
      .eq("order_id", result.orderId)
      .limit(1);
    return NextResponse.json({
      status: "consumed",
      orderId: result.orderId,
      hasDesigns: (designFiles?.length ?? 0) > 0,
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
