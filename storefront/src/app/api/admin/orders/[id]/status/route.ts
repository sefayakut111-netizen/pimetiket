/**
 * /api/admin/orders/[id]/status — admin status update + audit log.
 *
 * POST { status, note? }
 * - orders.status update via fn_transition_order_status
 * - order_events + audit_log RPC tarafından yazılır
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  transitionOrderStatus,
  transitionHttpStatus,
} from "@/lib/db/transition-order-status";
import { isOrderStatus } from "@/lib/order";

interface BodyShape {
  status?: unknown;
  note?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" && isOrderStatus(body.status)
      ? body.status
      : null;
  if (!status) {
    return NextResponse.json({ error: "Geçersiz status" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const auth = await assertPermission("orders", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: existingData, error: existingErr } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (existingErr || !existingData) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  const existing = existingData as { id: string; status: string };
  if (existing.status === status) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const actorRole = auth.role === "admin" ? "admin" : "staff";
  const summary = `Status: ${existing.status} → ${status}${note ? " · " + note : ""}`;

  const result = await transitionOrderStatus(admin, {
    orderId,
    to: status,
    from: existing.status as typeof status,
    mode: "admin_override",
    actorId: auth.user.id,
    actorRole,
    eventType: "status_changed",
    summary,
    detail: { from: existing.status, to: status, note },
    audit: {
      action: status === "cancelled" ? "order.cancel" : "order.status_change",
      summary: `Sipariş ${orderId}: ${existing.status} → ${status}${note ? " · " + note : ""}`,
      detail: { from: existing.status, to: status, note },
      actorEmail: auth.user.email ?? null,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    },
  });

  if (!result.ok) {
    console.error("[admin status] transition error:", result.error);
    return NextResponse.json(
      { error: result.error },
      { status: transitionHttpStatus(result.error) }
    );
  }

  if (status === "cancelled") {
    const { data: orderOwner } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .maybeSingle();
    const userId = (orderOwner as { user_id?: string } | null)?.user_id;
    if (userId) {
      const { sendOrderCancelled } = await import("@/lib/mail/notifications");
      void sendOrderCancelled({
        userId,
        orderId,
        cancelSource: "admin",
        operatorNote: note,
      }).catch((err) =>
        console.error("[admin/status] order_cancelled mail:", err)
      );
    }
  }

  return NextResponse.json({
    ok: true,
    from: existing.status,
    to: status,
  });
}
