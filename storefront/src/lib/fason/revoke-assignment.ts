/**
 * Admin — fason atamasını geri al (iptal).
 * Assignment cancelled, token revoke, sipariş durumu geri alınır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logOrderEvent } from "@/lib/order-events-server";

export const REVOKABLE_ASSIGNMENT_STATUSES = new Set([
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
  "issue",
]);

const ORDER_STATUSES_AFTER_ASSIGN = new Set([
  "fason_assigned",
  "in_production",
]);

export type RevokeAssignmentResult =
  | {
      ok: true;
      orderId: string;
      orderStatusBefore: string;
      orderStatusAfter: string;
      partnerName: string;
    }
  | { ok: false; error: string; status: number };

export async function revokeFasonAssignment(
  admin: SupabaseClient,
  opts: {
    assignmentId: string;
    adminUserId: string;
    reason?: string;
  }
): Promise<RevokeAssignmentResult> {
  const { data: asgRow, error: asgErr } = await admin
    .from("order_assignments")
    .select("id, order_id, fason_partner_id, status")
    .eq("id", opts.assignmentId)
    .maybeSingle();

  if (asgErr || !asgRow) {
    return { ok: false, error: "Atama bulunamadi", status: 404 };
  }

  const assignment = asgRow as {
    id: string;
    order_id: string;
    fason_partner_id: string;
    status: string;
  };

  if (!REVOKABLE_ASSIGNMENT_STATUSES.has(assignment.status)) {
    return {
      ok: false,
      error: `Bu durumda atama geri alinamaz (${assignment.status})`,
      status: 409,
    };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", assignment.order_id)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, error: "Siparis bulunamadi", status: 404 };
  }

  const order = orderRow as { id: string; status: string };
  if (order.status === "cancelled" || order.status === "delivered") {
    return {
      ok: false,
      error: "Iptal edilmis veya teslim edilmis siparis",
      status: 409,
    };
  }

  const { data: partnerRow } = await admin
    .from("fason_partners")
    .select("name, contact_email")
    .eq("id", assignment.fason_partner_id)
    .maybeSingle();
  const partnerName =
    (partnerRow as { name?: string } | null)?.name ?? "Partner";
  const partnerEmail =
    (partnerRow as { contact_email?: string } | null)?.contact_email ?? null;

  const { data: assignEvent } = await admin
    .from("order_events")
    .select("status_after, detail")
    .eq("order_id", assignment.order_id)
    .eq("event_type", "fason_assigned")
    .order("created_at", { ascending: false })
    .limit(20);

  let revertStatus: string | null = null;
  for (const ev of (assignEvent ?? []) as Array<{
    status_after: string | null;
    detail: { assignment_id?: string } | null;
  }>) {
    const detail = ev.detail as { assignment_id?: string } | null;
    if (detail?.assignment_id === assignment.id && ev.status_after) {
      revertStatus = ev.status_after;
      break;
    }
  }

  if (!revertStatus) {
    revertStatus =
      order.status === "fason_assigned" ? "ready_to_ship" : order.status;
  }

  const now = new Date().toISOString();

  const { error: cancelErr } = await admin
    .from("order_assignments")
    .update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", assignment.id);

  if (cancelErr) {
    console.error("[revoke-assignment] cancel:", cancelErr);
    return { ok: false, error: "Atama iptal edilemedi", status: 500 };
  }

  await admin
    .from("fason_access_tokens")
    .update({ revoked_at: now })
    .eq("assignment_id", assignment.id)
    .is("revoked_at", null);

  await admin
    .from("fason_mail_outbox")
    .delete()
    .eq("assignment_id", assignment.id)
    .in("status", ["pending", "failed"]);

  if (partnerEmail) {
    const { sendFasonCancelled } = await import("@/lib/mail/notifications");
    void sendFasonCancelled({
      orderId: assignment.order_id,
      partnerEmail,
      assignmentId: assignment.id,
      partnerId: assignment.fason_partner_id,
    }).catch((err) =>
      console.error("[revoke-assignment] fason cancel mail:", err)
    );
  }

  let orderStatusAfter = order.status;
  if (ORDER_STATUSES_AFTER_ASSIGN.has(order.status)) {
    const { error: orderErr } = await admin
      .from("orders")
      .update({ status: revertStatus })
      .eq("id", order.id);

    if (orderErr) {
      console.error("[revoke-assignment] order revert:", orderErr);
      return {
        ok: false,
        error: "Siparis durumu geri alinamadi",
        status: 500,
      };
    }
    orderStatusAfter = revertStatus;
  }

  await logOrderEvent(admin, {
    orderId: order.id,
    eventType: "fason_cancelled",
    statusAfter: orderStatusAfter,
    actorId: opts.adminUserId,
    actorRole: "admin",
    summary: `Fason atamasi geri alindi: ${partnerName}`,
    detail: {
      assignment_id: assignment.id,
      fason_id: assignment.fason_partner_id,
      fason_name: partnerName,
      reason: opts.reason?.slice(0, 500) ?? null,
      order_status_before: order.status,
      order_status_after: orderStatusAfter,
    },
  });

  return {
    ok: true,
    orderId: order.id,
    orderStatusBefore: order.status,
    orderStatusAfter,
    partnerName,
  };
}
