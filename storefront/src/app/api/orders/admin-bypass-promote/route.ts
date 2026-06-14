import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { promoteOrderDesigns } from "@/lib/storage/promote-temp-designs";
import { transitionOrderStatus } from "@/lib/db/transition-order-status";
import { runOrderDesignQC } from "@/lib/agents/run-order-qc";
import {
  orderItemHasDesigns,
} from "@/lib/order-item-meta";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await assertPermission("manual_order", "create");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { orderId } = (await req.json()) as { orderId?: string };
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();

  const orderUserId = (orderRow as { user_id: string } | null)?.user_id;
  if (!orderUserId) {
    console.warn("[promote] order not found:", orderId);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: items } = await admin
    .from("order_items")
    .select("id, product, meta")
    .eq("order_id", orderId);

  const allItems =
    (items as unknown as Array<{
      id: string;
      product: "sticker" | "etiket";
      meta: Record<string, unknown>;
    }>) ?? [];

  const orderItems = allItems.filter((i) => orderItemHasDesigns(i.meta));

  let promoted = 0;
  if (orderItems.length > 0) {
    promoted = await promoteOrderDesigns({
      admin,
      orderId,
      userId: orderUserId,
      orderItems,
    });
  }

  if (promoted > 0) {
    await transitionOrderStatus(admin, {
      orderId,
      to: "qc_pending",
      mode: "admin_override",
      actorId: auth.user.id,
      actorRole: auth.role === "admin" ? "admin" : "staff",
      eventType: "status_changed",
      summary: "Admin bypass promote — qc_pending",
      detail: { promoted, trigger: "admin-bypass-promote" },
    });

    // QC'yi doğrudan çalıştır (after() yerine — lambda kapanma riski yok)
    try {
      const qcResult = await runOrderDesignQC(admin, orderId);
      return NextResponse.json({ ok: true, promoted, qc: qcResult.aggregateVerdict });
    } catch (qcErr) {
      console.error("[promote] QC failed:", qcErr);
      return NextResponse.json({ ok: true, promoted, qc: "error" });
    }
  }

  return NextResponse.json({ ok: true, promoted });
}
