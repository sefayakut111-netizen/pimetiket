/**
 * POST /api/partner/orders/[id]/status
 *
 * Partner panelinden atama durumu güncelleme.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import {
  applyAssignmentAction,
  VALID_FASON_ACTIONS,
  type FasonAction,
} from "@/lib/fason/apply-assignment-action";

export const runtime = "nodejs";

interface BodyShape {
  action?: unknown;
  issue?: {
    category?: unknown;
    description?: unknown;
    photoStoragePath?: unknown;
  };
  tracking?: {
    company?: unknown;
    number?: unknown;
    url?: unknown;
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  if (!rawOrderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ctx.isPreview || ctx.isGenericPreview) {
    return NextResponse.json(
      { error: "preview_readonly", message: "Denetim modunda güncelleme yapılamaz." },
      { status: 403 }
    );
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actionStr = typeof body.action === "string" ? body.action : "";
  if (!VALID_FASON_ACTIONS.includes(actionStr as FasonAction)) {
    return NextResponse.json({ error: "Geçersiz aksiyon" }, { status: 400 });
  }
  const action = actionStr as FasonAction;

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  const { data: orderRow } = await admin
    .from("orders")
    .select("id")
    .ilike("id", rawOrderId)
    .maybeSingle();
  const order = orderRow as { id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const { data: asgRow } = await admin
    .from("order_assignments")
    .select("id, fason_partner_id, status")
    .eq("order_id", order.id)
    .in("status", [
      "assigned",
      "sent",
      "acknowledged",
      "in_production",
      "ready",
    ])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type AsgRow = { id: string; fason_partner_id: string; status: string };
  const assignment = asgRow as AsgRow | null;
  if (!assignment || assignment.fason_partner_id !== partnerId) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }

  const result = await applyAssignmentAction(admin, {
    assignmentId: assignment.id,
    orderId: order.id,
    action,
    body: { issue: body.issue, tracking: body.tracking },
    actorRole: "fason",
    via: "partner_panel",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, newStatus: result.newStatus });
}
