import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerAudit } from "@/lib/audit-log-server";

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
  };
  const { capabilityId, verified } = body;

  if (!capabilityId || typeof verified !== "boolean") {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: cap } = await admin
    .from("partner_capabilities")
    .select("id, partner_id, capability_type, capability_value")
    .eq("id", capabilityId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!cap) {
    return NextResponse.json({ error: "Capability bulunamadı" }, { status: 404 });
  }

  const { error } = await admin
    .from("partner_capabilities")
    .update({
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
      ? `Partner capability onaylandı: ${cap.capability_type}/${cap.capability_value}`
      : `Partner capability onayı kaldırıldı: ${cap.capability_type}/${cap.capability_value}`,
    detail: {
      partner_id: partnerId,
      capability_type: cap.capability_type,
      capability_value: cap.capability_value,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
