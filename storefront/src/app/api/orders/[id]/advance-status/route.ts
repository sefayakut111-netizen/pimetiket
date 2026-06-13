import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";
import {
  transitionOrderStatus,
  transitionHttpStatus,
} from "@/lib/db/transition-order-status";
import {
  getValidTransitions,
  isOrderStatus,
  type OrderStatus,
} from "@/lib/order";

const TARGET_STATUS: OrderStatus = "qc_pending";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, user_id")
    .eq("id", orderId)
    .single();

  if (!order || (order as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentStatus = (order as { status: string }).status;
  if (!isOrderStatus(currentStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 409 });
  }

  if (currentStatus !== "awaiting_upload" && currentStatus !== "paid") {
    return NextResponse.json({
      ok: true,
      status: currentStatus,
      message: "Already advanced",
    });
  }

  if (!getValidTransitions(currentStatus).includes(TARGET_STATUS)) {
    return NextResponse.json(
      { ok: false, error: "invalid_transition", from: currentStatus, to: TARGET_STATUS },
      { status: 409 }
    );
  }

  const { count } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", ["uploaded", "analyzing", "qc_passed", "qc_warned"]);

  if (!count || count === 0) {
    return NextResponse.json({ ok: false, error: "No design files found" });
  }

  const result = await transitionOrderStatus(admin, {
    orderId,
    to: TARGET_STATUS,
    from: currentStatus,
    mode: "forward",
    actorId: user.id,
    actorRole: "customer",
    eventType: "status_changed",
    summary: `Tasarım yüklendi — ${currentStatus} → ${TARGET_STATUS}`,
    detail: {
      from: currentStatus,
      to: TARGET_STATUS,
      trigger: "advance-status",
    },
  });

  if (!result.ok) {
    console.error("[advance-status] transition failed:", result.error);
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: transitionHttpStatus(result.error) }
    );
  }

  scheduleOrderDesignQC(admin, orderId);

  return NextResponse.json({ ok: true, status: TARGET_STATUS });
}
