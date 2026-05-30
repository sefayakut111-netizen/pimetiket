import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerAudit } from "@/lib/audit-log-server";

type ApprovalStatus = "pending" | "approved" | "rejected";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: partnerId } = await params;
  const body = (await req.json()) as {
    capabilityId?: string;
    verified?: boolean;
    status?: ApprovalStatus;
  };
  const { capabilityId } = body;

  if (!capabilityId) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  let approvalStatus: ApprovalStatus;
  if (body.status) {
    approvalStatus = body.status;
  } else if (typeof body.verified === "boolean") {
    approvalStatus = body.verified ? "approved" : "rejected";
  } else {
    return NextResponse.json({ error: "status veya verified gerekli" }, { status: 400 });
  }

  const verified = approvalStatus === "approved";
  const admin = createAdminClient();

  const { data: cap } = await admin
    .from("partner_capabilities")
    .select("id, partner_id, capability_type, capability_value")
    .eq("id", capabilityId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!cap) {
    return NextResponse.json({ error: "Capability bulunamadi" }, { status: 404 });
  }

  const { error } = await admin
    .from("partner_capabilities")
    .update({
      approval_status: approvalStatus,
      is_verified: verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? auth.user.id : null,
    })
    .eq("id", capabilityId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: verified ? "partner.capability_verify" : "partner.capability_unverify",
    targetType: "partner_capability",
    targetId: capabilityId,
    summary: verified
      ? `Partner capability onaylandi: ${cap.capability_type}/${cap.capability_value}`
      : `Partner capability ${approvalStatus}: ${cap.capability_type}/${cap.capability_value}`,
    detail: {
      partner_id: partnerId,
      capability_type: cap.capability_type,
      capability_value: cap.capability_value,
      approval_status: approvalStatus,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, approval_status: approvalStatus });
}
