/**
 * POST /api/admin/shipments/[orderId]/override
 *
 * Sefa 18 May v68:
 * Admin manual durum override — Yurtiçi API hatalı/eksik veri verirse veya
 * istisnai durum varsa admin manuel event ekler.
 *
 * Request body:
 *   {
 *     status: 'created'|'picked_up'|'in_transit'|'out_for_delivery'|'delivered'|'failed'|'returned'|'cancelled',
 *     description: string,
 *     location?: string,
 *     reason: string  (zorunlu — audit için)
 *   }
 *
 * Yan etki:
 *   - shipment_status_events'e admin override kaydı düşer
 *   - order_assignments.tracking_status güncellenir
 *   - delivered ise tracking_delivered_at set edilir
 *   - order_events log'a "admin_override" kaydı düşer
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { logOrderEvent } from "@/lib/order-events-server";

export const runtime = "nodejs";

const VALID_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await assertPermission("shipments", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const status = (body.status as string | undefined)?.trim();
  const description = (body.description as string | undefined)?.trim();
  const location = (body.location as string | undefined)?.trim() ?? null;
  const reason = (body.reason as string | undefined)?.trim();

  if (!status || !VALID_STATUSES.includes(status as never)) {
    return NextResponse.json(
      { error: `status eksik veya geçersiz. Kabul: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!description) {
    return NextResponse.json(
      { error: "description zorunlu" },
      { status: 400 }
    );
  }

  if (!reason) {
    return NextResponse.json(
      { error: "reason zorunlu (audit için)" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Mevcut assignment bul
  const { data: assignments } = await supabase
    .from("order_assignments")
    .select("id, tracking_number")
    .eq("order_id", orderId)
    .order("assigned_at", { ascending: false })
    .limit(1);

  if (!assignments || assignments.length === 0) {
    return NextResponse.json(
      { error: "Sipariş için assignment bulunamadı" },
      { status: 404 }
    );
  }

  const assignmentId = (assignments[0] as { id: string }).id;

  // Manual event insert (admin override)
  const now = new Date();
  const { error: insErr } = await supabase
    .from("shipment_status_events")
    .upsert(
      {
        order_id: orderId,
        assignment_id: assignmentId,
        status,
        raw_status_code: "ADMIN_OVERRIDE",
        description: `[Admin override] ${description}`,
        location,
        event_time: now.toISOString(),
        polled_at: now.toISOString(),
        raw_payload: {
          override_by: auth.user.email ?? auth.user.id,
          reason,
        },
      },
      { onConflict: "order_id,status,event_time", ignoreDuplicates: false }
    );

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Assignment güncelle
  const updatePayload: Record<string, unknown> = {
    tracking_status: status,
    tracking_last_polled_at: now.toISOString(),
  };
  if (status === "delivered") {
    updatePayload.tracking_delivered_at = now.toISOString();
  }

  const { error: updErr } = await supabase
    .from("order_assignments")
    .update(updatePayload)
    .eq("id", assignmentId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Order events audit log
  await logOrderEvent(supabase, {
    orderId,
    eventType: "shipping_admin_override",
    actorId: auth.user.id,
    actorRole: auth.role === "admin" ? "admin" : "staff",
    summary: `Kargo durumu manuel override: ${status}`,
    detail: {
      override_status: status,
      description,
      location,
      reason,
      admin_email: auth.user.email,
    },
  });

  return NextResponse.json({ success: true, status, eventTime: now.toISOString() });
}
