/**
 * GET /api/cron/auto-refund
 *
 * Vercel Cron tarafından günlük 02:00'da çağrılır (vercel.json).
 *
 * SLA kaskadı (Migration 111 + bu route):
 *   1) 12sa+ onaysız → hatırlatma maili + proof_reminder_sent event
 *   2) 36sa+ onaysız → iptal + auto_refund_stale_proof event + iade maili
 *
 * Auth: CRON_SECRET env var (Vercel Cron otomatik Authorization header
 * gönderir).
 *
 * Test (manuel):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://pimetiket.com/api/cron/auto-refund
 */

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import {
  sendAutoRefundStaleProof,
  sendOrderProofReminder,
} from "@/lib/mail/notifications";
import { logOrderEvent } from "@/lib/order-events-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type AdminClient = SupabaseClient<Database>;

interface SlaProcessRow {
  order_id: string;
  user_id: string;
  action: "reminder" | "refund";
  hours_since_proof: number;
}

async function processReminder(
  admin: AdminClient,
  row: SlaProcessRow
): Promise<{ ok: boolean; reason?: string }> {
  if (!row.user_id) {
    return { ok: false, reason: "no_user_id" };
  }

  const result = await sendOrderProofReminder({
    userId: row.user_id,
    orderId: row.order_id,
    pendingCount: 1,
    hoursSincePaid: Math.round(row.hours_since_proof),
  });

  if (!result.ok) {
    return result;
  }

  await logOrderEvent(admin, {
    orderId: row.order_id,
    eventType: "proof_reminder_sent",
    statusAfter: "proof_pending",
    actorRole: "system",
    summary: "SLA hatırlatma maili gönderildi (12sa+ onaysız)",
    detail: {
      auto: true,
      hours_since_proof: row.hours_since_proof,
    },
  });

  return { ok: true };
}

async function processRefund(
  admin: AdminClient,
  row: SlaProcessRow
): Promise<{ ok: boolean; reason?: string }> {
  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", row.order_id)
    .eq("status", "proof_pending")
    .select("id")
    .maybeSingle();

  if (updateErr || !updated) {
    return {
      ok: false,
      reason: updateErr?.message ?? "order_not_proof_pending",
    };
  }

  await logOrderEvent(admin, {
    orderId: row.order_id,
    eventType: "auto_refund_stale_proof",
    statusAfter: "cancelled",
    actorRole: "system",
    summary: "36 saat onaysız iade — müşteri prova onayı vermedi",
    detail: {
      auto: true,
      hours_since_proof: row.hours_since_proof,
    },
  });

  if (!row.user_id) {
    return { ok: true, reason: "cancelled_no_user_mail" };
  }

  const mail = await sendAutoRefundStaleProof({
    userId: row.user_id,
    orderId: row.order_id,
  });

  return mail.ok ? { ok: true } : { ok: false, reason: mail.reason };
}

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("auto-refund", async () => {
      const admin = createAdminClient();

      const { data, error } = await admin.rpc(
        "fn_process_proof_pending_sla" as "fn_auto_refund_stale_proofs"
      );

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data as SlaProcessRow[]) ?? [];
      const reminders = rows.filter((r) => r.action === "reminder");
      const refunds = rows.filter((r) => r.action === "refund");

      const reminderResults = await Promise.allSettled(
        reminders.map((r) => processReminder(admin, r))
      );

      const refundResults = await Promise.allSettled(
        refunds.map((r) => processRefund(admin, r))
      );

      const reminderOk = reminderResults.filter(
        (r) => r.status === "fulfilled" && r.value.ok
      ).length;
      const reminderFail = reminderResults.length - reminderOk;

      const refundOk = refundResults.filter(
        (r) => r.status === "fulfilled" && r.value.ok
      ).length;
      const refundFail = refundResults.length - refundOk;

      if (reminderFail > 0) {
        console.warn(
          `[cron/auto-refund] ${reminderFail}/${reminders.length} reminder başarısız`
        );
      }
      if (refundFail > 0) {
        console.warn(
          `[cron/auto-refund] ${refundFail}/${refunds.length} refund başarısız`
        );
      }

      console.log(
        `[cron/auto-refund] SLA kaskadı: ${reminderOk} hatırlatma, ${refundOk} iptal`
      );

      return {
        summary: `${reminderOk} hatırlatma, ${refundOk} iptal`,
        itemsProcessed: reminderOk + refundOk,
        data: {
          ok: true,
          reminder_count: reminderOk,
          refund_count: refundOk,
          reminder_failures: reminderFail,
          refund_failures: refundFail,
          orders: { reminders, refunds },
          timestamp: new Date().toISOString(),
        },
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/auto-refund]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
