/**
 * /api/orders/[id]/proof-respond — müşteri prova yanıtı.
 *
 * POST { action: "approve" | "request_change", note? }
 * - approve: order_status proof_pending → in_production
 * - request_change: order_status proof_pending → operator_review
 *
 * Sadece sipariş sahibi çağırabilir + sipariş status proof_pending olmalı.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  transitionOrderStatus,
  transitionHttpStatus,
} from "@/lib/db/transition-order-status";

interface BodyShape {
  action?: unknown;
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

  const action = body.action === "approve" ? "approve" : body.action === "request_change" ? "request_change" : null;
  if (!action) {
    return NextResponse.json({ error: "Geçersiz aksiyon" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: orderData, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .single();
  if (orderErr || !orderData) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  const order = orderData as { id: string; user_id: string; status: string };
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "Bu sipariş sana ait değil" }, { status: 403 });
  }
  if (order.status !== "proof_pending") {
    return NextResponse.json(
      { error: `Sipariş prova bekleme durumunda değil (${order.status})` },
      { status: 400 }
    );
  }

  const newStatus =
    action === "approve" ? "in_production" : "operator_review";

  const eventType =
    action === "approve" ? "proof_approved" : "proof_change_requested";
  const summary =
    action === "approve"
      ? "Müşteri provayı onayladı"
      : `Müşteri değişiklik talep etti${note ? ": " + note : ""}`;

  const result = await transitionOrderStatus(admin, {
    orderId,
    to: newStatus,
    from: "proof_pending",
    mode: "forward",
    actorId: user.id,
    actorRole: "customer",
    eventType,
    summary,
    detail: note ? { note } : {},
  });

  if (!result.ok) {
    console.error("[proof-respond] transition error:", result.error);
    return NextResponse.json(
      { error: "Güncelleme başarısız" },
      { status: transitionHttpStatus(result.error) }
    );
  }

  return NextResponse.json({ ok: true, newStatus });
}
