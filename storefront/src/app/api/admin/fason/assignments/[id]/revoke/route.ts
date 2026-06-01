/**
 * POST /api/admin/fason/assignments/[id]/revoke
 *
 * Admin — partner atamasini geri alir.
 * Body: { reason?: string }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerAudit } from "@/lib/audit-log-server";
import { revokeFasonAssignment } from "@/lib/fason/revoke-assignment";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await assertPermission("fason", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: assignmentId } = await params;
  if (!assignmentId) {
    return NextResponse.json({ error: "Atama ID eksik" }, { status: 400 });
  }

  let reason: string | undefined;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim().slice(0, 500);
    }
  } catch {
    /* body opsiyonel */
  }

  const admin = createAdminClient();
  const result = await revokeFasonAssignment(admin, {
    assignmentId,
    adminUserId: auth.user.id,
    reason,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role === "admin" ? "admin" : "staff",
    action: "order.status_change",
    targetType: "order",
    targetId: result.orderId,
    summary: `Fason atamasi geri alindi (${result.partnerName}): ${result.orderStatusBefore} → ${result.orderStatusAfter}`,
    detail: {
      kind: "fason_assignment_revoked",
      assignment_id: assignmentId,
      partner_name: result.partnerName,
      reason: reason ?? null,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    orderStatusAfter: result.orderStatusAfter,
    partnerName: result.partnerName,
  });
}
