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
  sendOrderProofReminder,
  sendOrderCancelled,
  sendRefundCompleted,
} from "@/lib/mail/notifications";
import { logOrderEvent } from "@/lib/order-events-server";
import { isPayTrConfigured, refundPayment } from "@/lib/payment/paytr";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TablesInsert } from "@/lib/supabase/types";

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

interface PaymentChargeRow {
  id: string;
  psp_transaction_id: string | null;
  amount: number;
}

async function processRefund(
  admin: AdminClient,
  row: SlaProcessRow
): Promise<{ ok: boolean; reason?: string }> {
  const orderId = row.order_id;

  const { data: claimed, error: claimErr } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("status", "proof_pending")
    .select("id, total")
    .maybeSingle();

  if (claimErr || !claimed) {
    return {
      ok: false,
      reason: claimErr?.message ?? "order_not_proof_pending",
    };
  }

  let refundAmount: number | null = null;
  let refundPaymentId: string | undefined;

  if (isPayTrConfigured()) {
    const { data: charges } = await admin
      .from("payments")
      .select("id, psp_transaction_id, amount")
      .eq("order_id", orderId)
      .eq("action", "charge")
      .eq("status", "success")
      .eq("psp_provider", "paytr")
      .order("created_at", { ascending: false })
      .limit(1);

    const charge = (charges as PaymentChargeRow[] | null)?.[0];

    if (charge?.psp_transaction_id) {
      const { data: existingRefunds } = await admin
        .from("payments")
        .select("amount")
        .eq("order_id", orderId)
        .in("action", ["refund", "partial_refund"])
        .eq("status", "success");

      const refundedSoFar = (
        (existingRefunds as { amount: number }[] | null) ?? []
      ).reduce((s, r) => s + Number(r.amount), 0);

      const remaining = charge.amount - refundedSoFar;

      if (remaining > 0) {
        const { data: placeholderRow, error: phErr } = await admin
          .from("payments")
          .insert([
            {
              order_id: orderId,
              psp_provider: "paytr",
              psp_transaction_id: charge.psp_transaction_id,
              action: "refund",
              amount: remaining,
              currency: "TRY",
              status: "processing",
              idempotency_key: `auto-refund-stale-proof:${orderId}`,
              psp_raw: {
                refund_amount: remaining,
                reason: "auto_refund_stale_proof",
              } satisfies Json,
            } satisfies TablesInsert<"payments">,
          ])
          .select("id")
          .single();

        if (phErr) {
          const code = (phErr as { code?: string }).code;
          if (code === "23505") {
            console.warn(
              `[cron/auto-refund] refund already in progress for ${orderId}`
            );
            await admin
              .from("orders")
              .update({ status: "proof_pending" })
              .eq("id", orderId)
              .eq("status", "cancelled");
            return { ok: false, reason: "refund_already_in_progress" };
          }

          console.error(
            `[cron/auto-refund] refund placeholder failed for ${orderId}:`,
            phErr
          );
          await admin
            .from("orders")
            .update({ status: "proof_pending" })
            .eq("id", orderId)
            .eq("status", "cancelled");
          return { ok: false, reason: "refund_init_failed" };
        }

        const placeholderId = (placeholderRow as { id: string }).id;
        refundPaymentId = placeholderId;
        const result = await refundPayment({
          merchantOid: charge.psp_transaction_id,
          returnAmountTL: remaining,
        });

        if (!result.ok) {
          await admin
            .from("payments")
            .update({
              status: "failed",
              psp_raw: {
                refund_amount: remaining,
                reason: "auto_refund_stale_proof",
                paytr_error: { reason: result.reason, code: result.errCode },
              } satisfies Json,
            })
            .eq("id", placeholderId);

          await admin
            .from("orders")
            .update({ status: "proof_pending" })
            .eq("id", orderId)
            .eq("status", "cancelled");

          console.error(
            `[cron/auto-refund] PayTR refund rejected for ${orderId}:`,
            result.reason
          );
          return { ok: false, reason: result.reason ?? "paytr_refund_rejected" };
        }

        await admin
          .from("payments")
          .update({
            status: "success",
            completed_at: new Date().toISOString(),
          })
          .eq("id", placeholderId);

        refundAmount = remaining;
      }
    }
  }

  await logOrderEvent(admin, {
    orderId,
    eventType: "auto_refund_stale_proof",
    statusAfter: "cancelled",
    actorRole: "system",
    summary:
      refundAmount != null
        ? `36 saat onaysız iade — ${refundAmount.toFixed(2)} ₺ PayTR iadesi`
        : "36 saat onaysız iade — müşteri prova onayı vermedi",
    detail: {
      auto: true,
      hours_since_proof: row.hours_since_proof,
      refundAmount,
    },
  });

  if (!row.user_id) {
    return { ok: true, reason: "cancelled_no_user_mail" };
  }

  void sendOrderCancelled({
    userId: row.user_id,
    orderId,
    cancelSource: "stale_proof",
    refundAmount,
    refundInitiated: refundAmount != null && refundAmount > 0,
  }).catch((err) =>
    console.error(`[cron/auto-refund] cancel mail ${orderId}:`, err)
  );

  if (refundAmount != null && refundAmount > 0) {
    const { sendAdminAutoRefund } = await import("@/lib/mail/notifications");
    void sendAdminAutoRefund({
      orderId,
      userId: row.user_id,
      refundAmount,
    }).catch((err) =>
      console.error(`[cron/auto-refund] admin notify ${orderId}:`, err)
    );
  }

  if (refundAmount != null && refundAmount > 0) {
    const mail = await sendRefundCompleted({
      userId: row.user_id,
      orderId,
      refundAmount,
      refundPaymentId,
    });
    return mail.ok ? { ok: true } : { ok: false, reason: mail.reason };
  }

  return { ok: true };
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
