/**
 * POST /api/admin/orders/[id]/approval-requests/[reqId]/cancel
 * Admin pending isteği iptal eder.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: orderId, reqId } = await params;
  if (!orderId || !reqId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("proof", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: requestRow } = await admin
    .from("approval_requests")
    .select("id, order_id, status, title")
    .eq("id", reqId)
    .eq("order_id", orderId)
    .maybeSingle();

  const request = requestRow as {
    id: string;
    order_id: string;
    status: string;
    title: string;
  } | null;

  if (!request) {
    return NextResponse.json({ error: "request_not_found" }, { status: 404 });
  }

  if (request.status !== "pending") {
    return NextResponse.json(
      { error: "request_not_pending", status: request.status },
      { status: 409 }
    );
  }

  const { error: updateErr } = await admin
    .from("approval_requests")
    .update({ status: "cancelled" })
    .eq("id", reqId)
    .eq("status", "pending");

  if (updateErr) {
    console.error("[approval-cancel] update failed:", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const eventDetail: Json = {
    request_id: reqId,
    title: request.title,
  };

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "approval_cancelled",
      summary: `Onay görseli isteği iptal: ${request.title}`,
      actor_id: auth.user.id,
      actor_role: auth.role,
      detail: eventDetail,
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({ ok: true, status: "cancelled" });
}
