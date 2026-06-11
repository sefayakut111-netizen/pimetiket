/**
 * GET /api/partner/orders/[id]/shipping-info
 *
 * Model B — partner müşteriye direkt kargolar; tam teslimat adresi yalnızca
 * atama statüsü ready | in_production iken döner. Her çağrı audit_log'a yazılır.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";
import {
  canPartnerViewFullShippingAddress,
  partnerShippingAddressDeniedMessage,
} from "@/lib/fason/partner-shipping-access";
import { fullOrderAddressForPartnerShipping } from "@/lib/fason/redact-order-address";

export const runtime = "nodejs";

async function logPartnerAddressViewed(input: {
  actorId: string;
  actorEmail: string | null;
  partnerId: string;
  orderId: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const admin = createAdminClient();
  try {
    const { error } = await admin.from("audit_log").insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail,
      actor_role: null,
      action: "partner.address_viewed",
      target_type: "order",
      target_id: input.orderId,
      summary: `Partner teslimat adresi görüntüledi (${input.orderId})`,
      detail: {
        partner_id: input.partnerId,
        order_id: input.orderId,
        viewed_at: new Date().toISOString(),
      },
      ip_address: normalizeIp(input.ipAddress),
      user_agent: input.userAgent?.slice(0, 500) ?? null,
    });
    if (error) {
      console.error("[partner/shipping-info] audit insert:", error.message);
    }
  } catch (err) {
    console.error(
      "[partner/shipping-info] audit unexpected:",
      err instanceof Error ? err.message : err
    );
  }
}

function normalizeIp(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first || !/^[0-9a-f.:]+$/i.test(first)) return null;
  return first;
}

export async function GET(
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
      {
        error: "preview_readonly",
        message: "Denetim modunda teslimat adresi gösterilmez.",
      },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, address")
    .ilike("id", rawOrderId)
    .maybeSingle();
  type OrderRow = {
    id: string;
    address: Record<string, unknown> | null;
  };
  const order = orderRow as OrderRow | null;
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
    return NextResponse.json(
      {
        error: "not_your_order",
        message: "Bu sipariş size atanmamış veya erişim süresi dolmuş.",
      },
      { status: 403 }
    );
  }

  const assignmentStatus = asg.assignment.status;
  if (!canPartnerViewFullShippingAddress(assignmentStatus)) {
    return NextResponse.json(
      {
        error: "address_not_available",
        message: partnerShippingAddressDeniedMessage(assignmentStatus),
        assignment_status: assignmentStatus,
      },
      { status: 403 }
    );
  }

  const shipping = fullOrderAddressForPartnerShipping(order.address);
  if (!shipping) {
    return NextResponse.json(
      {
        error: "address_incomplete",
        message:
          "Sipariş teslimat adresi eksik — operasyon ekibiyle iletişime geç.",
      },
      { status: 422 }
    );
  }

  await logPartnerAddressViewed({
    actorId: ctx.userId,
    actorEmail: null,
    partnerId,
    orderId: order.id,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    order_id: order.id,
    assignment_status: assignmentStatus,
    shipping,
  });
}
