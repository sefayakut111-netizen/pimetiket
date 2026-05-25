/**
 * GET /api/cron/auto-refund
 *
 * Vercel Cron tarafından günlük 02:00'da çağrılır (vercel.json).
 *
 * Sefa 20 May v68 (P1 #10 SLA kaskadı):
 * Eskiden sadece 36 saat = iade kontrolü vardı. Artık iki aşamalı:
 *   1) 12sa+ onaysız → hatırlatma maili (sendOrderProofReminder, idempotent)
 *   2) 36sa+ onaysız → otomatik iptal (anayasa kuralı bozulmaz)
 *
 * Eski Mig 017 (fn_auto_refund_stale_proofs) yerine Mig 070
 * (fn_process_proof_pending_sla) kullanılır. Eski RPC geriye uyumluluk
 * için DB'de kalır ama bu route artık onu çağırmaz.
 *
 * Auth: CRON_SECRET env var (Vercel Cron otomatik Authorization header
 * gönderir).
 *
 * Test (manuel):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://pimetiket.com/api/cron/auto-refund
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { sendOrderProofReminder } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

interface SlaProcessRow {
  order_id: string;
  user_id: string;
  action: "reminder" | "refund";
  hours_since_proof: number;
}

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("auto-refund", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await admin.rpc("fn_process_proof_pending_sla");

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data as SlaProcessRow[]) ?? [];
      const reminders = rows.filter((r) => r.action === "reminder");
      const refunds = rows.filter((r) => r.action === "refund");

      const reminderResults = await Promise.allSettled(
        reminders.map((r) =>
          sendOrderProofReminder({
            userId: r.user_id,
            orderId: r.order_id,
            pendingCount: 1,
            hoursSincePaid: Math.round(r.hours_since_proof),
          })
        )
      );

      const reminderFail = reminderResults.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.ok)
      );

      if (reminderFail.length > 0) {
        console.warn(
          `[cron/auto-refund] ${reminderFail.length}/${reminders.length} reminder mail başarısız`
        );
      }

      console.log(
        `[cron/auto-refund] SLA kaskadı: ${reminders.length} hatırlatma, ${refunds.length} iptal`
      );

      return {
        summary: `${reminders.length} hatırlatma, ${refunds.length} iptal`,
        itemsProcessed: reminders.length + refunds.length,
        data: {
          ok: true,
          reminder_count: reminders.length,
          refund_count: refunds.length,
          reminder_failures: reminderFail.length,
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
