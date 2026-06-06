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
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";
import { isPartnerPending } from "@/lib/fason/partner-proof-status";

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

  const asg = await assertActivePartnerAssignment(
    admin,
    order.id,
    partnerId,
    "id, fason_partner_id, status"
  );
  if (!asg.ok) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }
  const assignment = asg.assignment;

  if (action === "in_production") {
    const { data: itemRows, error: itemsErr } = await admin
      .from("order_items")
      .select("proof_status")
      .eq("order_id", order.id);

    if (itemsErr) {
      console.error("[partner/status] items read error:", itemsErr);
      return NextResponse.json(
        { error: "items_read_failed" },
        { status: 500 }
      );
    }

    const items = (itemRows ?? []) as Array<{ proof_status: string }>;
    if (items.length === 0) {
      return NextResponse.json(
        { error: "no_items", message: "Siparişte kalem yok." },
        { status: 400 }
      );
    }

    const allApproved = items.every((i) => i.proof_status === "partner_approved");
    const anyPending = items.some((i) => isPartnerPending(i.proof_status));
    if (!allApproved || anyPending) {
      return NextResponse.json(
        {
          error: "items_not_all_approved",
          message:
            "Üretime başlamak için tüm tasarımların onaylanmış olması gerekir.",
        },
        { status: 409 }
      );
    }
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
