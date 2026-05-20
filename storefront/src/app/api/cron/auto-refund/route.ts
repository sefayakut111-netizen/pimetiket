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
import { sendOrderProofReminder } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

interface SlaProcessRow {
  order_id: string;
  user_id: string;
  action: "reminder" | "refund";
  hours_since_proof: number;
}

export async function GET(req: Request) {
  // Vercel Cron auth — timing-safe
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase env eksik" },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // RPC çağır — Mig 070 SLA kaskadı
  const { data, error } = await admin.rpc(
    "fn_process_proof_pending_sla" as never
  );

  if (error) {
    console.error("[cron/auto-refund] rpc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as SlaProcessRow[]) ?? [];
  const reminders = rows.filter((r) => r.action === "reminder");
  const refunds = rows.filter((r) => r.action === "refund");

  // Reminder mailleri — paralel, idempotency RPC tarafında (order_events lookup)
  const reminderResults = await Promise.allSettled(
    reminders.map((r) =>
      sendOrderProofReminder({
        userId: r.user_id,
        orderId: r.order_id,
        pendingCount: 1, // proof_pending = tek prova bekliyor (multi-proof eklenirse güncellenecek)
        hoursSincePaid: Math.round(r.hours_since_proof),
      })
    )
  );

  const reminderFail = reminderResults.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
  );

  if (reminderFail.length > 0) {
    console.warn(
      `[cron/auto-refund] ${reminderFail.length}/${reminders.length} reminder mail başarısız:`,
      reminderFail.map((r, i) =>
        r.status === "rejected"
          ? { order: reminders[i]?.order_id, error: r.reason }
          : { order: reminders[i]?.order_id, reason: (r as PromiseFulfilledResult<{ reason?: string }>).value.reason }
      )
    );
  }

  // TODO: PayTR refund tetikleme (refunds için, PayTR canary sonrası)
  // Şu an sadece status değişikliği + audit log (Mig 070 RPC içinde yapıldı)

  console.log(
    `[cron/auto-refund] SLA kaskadı: ${reminders.length} hatırlatma, ${refunds.length} iptal`,
    { reminders, refunds }
  );

  return NextResponse.json({
    ok: true,
    reminder_count: reminders.length,
    refund_count: refunds.length,
    reminder_failures: reminderFail.length,
    orders: { reminders, refunds },
    timestamp: new Date().toISOString(),
  });
}
