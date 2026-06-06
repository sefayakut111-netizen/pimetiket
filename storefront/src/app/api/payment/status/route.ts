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
import { ensureOrderDesignsPromoted } from "@/lib/storage/promote-temp-designs";
import { orderItemsMetaHasDesignTempIds } from "@/lib/order-item-meta";

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
    const { data: intentRow } = await admin
      .from("payment_intents")
      .select("user_id")
      .eq("id", oid)
      .maybeSingle();
    const userId = (intentRow as { user_id: string } | null)?.user_id ?? user.id;

    const { hasDesignFiles } = await ensureOrderDesignsPromoted({
      admin,
      orderId: result.orderId,
      userId,
    });

    let hasDesigns = hasDesignFiles;
    if (!hasDesigns) {
      const { data: orderRow } = await admin
        .from("orders")
        .select("status")
        .eq("id", result.orderId)
        .maybeSingle();
      const status = (orderRow as { status: string } | null)?.status;
      if (status && status !== "awaiting_upload") {
        hasDesigns = true;
      } else {
        const { data: items } = await admin
          .from("order_items")
          .select("meta")
          .eq("order_id", result.orderId);
        hasDesigns = orderItemsMetaHasDesignTempIds(
          (items as Array<{ meta: Record<string, unknown> | null }> | null) ??
            []
        );
      }
    }

    return NextResponse.json({
      status: "consumed",
      orderId: result.orderId,
      hasDesigns,
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
