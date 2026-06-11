/**
 * POST /api/orders/[id]/approval-requests/[reqId]/decide
 * Müşteri onay / değişiklik isteği.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/lib/supabase/types";
import {
  canDecideApprovalRequest,
  parseApprovalDecision,
  validateApprovalDecisionInput,
} from "@/lib/approvals/approval-decide";

export const runtime = "nodejs";

interface BodyShape {
  decision?: unknown;
  comment?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: orderId, reqId } = await params;
  if (!orderId || !reqId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decision = parseApprovalDecision(body.decision);
  if (!decision) {
    return NextResponse.json({ error: "Geçersiz karar" }, { status: 400 });
  }

  const comment =
    typeof body.comment === "string" ? body.comment.trim() : null;
  const validationErr = validateApprovalDecisionInput(decision, comment);
  if (validationErr) {
    return NextResponse.json({ error: validationErr }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as { id: string; user_id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: requestRow, error: fetchErr } = await admin
    .from("approval_requests")
    .select("id, order_id, status, title, blocking")
    .eq("id", reqId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (fetchErr || !requestRow) {
    return NextResponse.json({ error: "request_not_found" }, { status: 404 });
  }

  const request = requestRow as {
    id: string;
    order_id: string;
    status: string;
    title: string;
    blocking: boolean;
  };

  if (!canDecideApprovalRequest(request.status)) {
    return NextResponse.json(
      { error: "request_not_pending", status: request.status },
      { status: 409 }
    );
  }

  const newStatus = decision === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();

  const { error: updateErr } = await admin
    .from("approval_requests")
    .update({
      status: newStatus,
      customer_comment: comment,
      decided_at: decidedAt,
    })
    .eq("id", reqId)
    .eq("status", "pending");

  if (updateErr) {
    console.error("[approval-decide] update failed:", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const { data: verifyRow } = await admin
    .from("approval_requests")
    .select("status")
    .eq("id", reqId)
    .maybeSingle();
  const verified = verifyRow as { status: string } | null;
  if (!verified || verified.status !== newStatus) {
    return NextResponse.json(
      { error: "request_not_pending", status: verified?.status },
      { status: 409 }
    );
  }

  const eventDetail: Json = {
    request_id: reqId,
    decision,
    blocking: request.blocking,
    title: request.title,
    customer_comment: comment,
  };

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "approval_decided",
      summary:
        decision === "approve"
          ? `Onay görseli onaylandı: ${request.title}`
          : `Onay görseli — değişiklik istendi: ${request.title}`,
      actor_id: user.id,
      actor_role: "customer",
      detail: eventDetail,
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({
    ok: true,
    status: newStatus,
    decided_at: decidedAt,
  });
}
