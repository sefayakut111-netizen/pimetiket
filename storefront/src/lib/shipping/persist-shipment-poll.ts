import type { SupabaseClient } from "@supabase/supabase-js";
import { casUpdate } from "@/lib/db/cas-update";
import type { YurticiQueryResult } from "@/lib/shipping/yurtici-api";

export interface PersistShipmentPollParams {
  assignmentId: string;
  orderId: string;
  trackingNumber: string;
  apiResult: YurticiQueryResult;
  sendMail: boolean;
}

export interface PersistShipmentPollResult {
  newEvents: number;
  skipped?: boolean;
  statusChanged?: boolean;
  justDelivered?: boolean;
}

type AssignmentSnapshot = {
  tracking_status: string | null;
  tracking_delivered_at: string | null;
};

const MAIL_STATUSES = new Set(["in_transit", "failed", "returned"]);

/**
 * Paylaşılan kargo poll persist — event upsert + CAS tracking_status + opsiyonel mail.
 * unknown event satırları CHECK nedeniyle atlanır; tracking_status='unknown' set edilebilir.
 */
export async function persistShipmentPoll(
  admin: SupabaseClient,
  params: PersistShipmentPollParams
): Promise<PersistShipmentPollResult> {
  const { assignmentId, orderId, trackingNumber, apiResult, sendMail } =
    params;

  if (!apiResult.success) {
    return { newEvents: 0 };
  }

  const now = new Date().toISOString();
  let newEvents = 0;

  for (const ev of apiResult.events) {
    if (ev.status === "unknown") continue;

    const { error: upErr } = await admin.from("shipment_status_events").upsert(
      {
        order_id: orderId,
        assignment_id: assignmentId,
        status: ev.status,
        raw_status_code: ev.rawStatusCode,
        description: ev.description,
        location: ev.location,
        event_time: ev.eventTime.toISOString(),
        polled_at: now,
        raw_payload: {},
      },
      {
        onConflict: "order_id,assignment_id,status,event_time",
        ignoreDuplicates: true,
      }
    );
    if (!upErr) newEvents++;
  }

  const { data: oldAssignment } = await admin
    .from("order_assignments")
    .select("tracking_status, tracking_delivered_at")
    .eq("id", assignmentId)
    .maybeSingle();

  const freshOldStatus =
    (oldAssignment as AssignmentSnapshot | null)?.tracking_status ?? null;
  const freshWasDelivered =
    (oldAssignment as AssignmentSnapshot | null)?.tracking_delivered_at !==
    null;

  const currentStatus = apiResult.currentStatus;
  if (!currentStatus) {
    return { newEvents };
  }

  const cas = await casUpdate(
    admin,
    "order_assignments",
    assignmentId,
    {
      tracking_status: currentStatus,
      tracking_last_polled_at: now,
      tracking_delivered_at: apiResult.deliveredAt?.toISOString() ?? null,
    },
    {
      expectFrom: freshOldStatus,
      col: "tracking_status",
    }
  );

  if (!cas.ok) {
    if (cas.reason === "stale") {
      return { newEvents, skipped: true };
    }
    console.error("[persistShipmentPoll] CAS error:", cas.error);
    return { newEvents, skipped: true };
  }

  const statusChanged = currentStatus !== freshOldStatus;
  const justDelivered = !freshWasDelivered && apiResult.deliveredAt;

  if (justDelivered && apiResult.deliveredAt) {
    console.log(
      `[persistShipmentPoll] ${orderId} delivered — mail skip (review_request 7gün sonra gönderir)`
    );
  }

  if (
    sendMail &&
    statusChanged &&
    MAIL_STATUSES.has(currentStatus)
  ) {
    const { data: orderInfo } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .maybeSingle();
    const userId = (orderInfo as { user_id?: string } | null)?.user_id;

    if (userId) {
      const lastEv = apiResult.events[apiResult.events.length - 1];
      const notif = await import("@/lib/mail/notifications");
      void notif.sendShipmentStatus({
        userId,
        orderId,
        status: currentStatus as "in_transit" | "failed" | "returned",
        description: lastEv?.description ?? "Durum güncellendi",
        location: lastEv?.location ?? null,
        trackingNumber,
        trackingUrl: null,
      });
    }
  }

  return {
    newEvents,
    statusChanged,
    justDelivered: Boolean(justDelivered),
  };
}
