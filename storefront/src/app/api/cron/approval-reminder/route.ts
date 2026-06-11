/**
 * GET /api/cron/approval-reminder
 *
 * 3+ gün pending onay görseli istekleri için müşteriye tek hatırlatma.
 * reminded_at ile istek başına max 1 mail.
 *
 * Auth: CRON_SECRET Bearer (Vercel Cron).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { sendApprovalRequestReminder } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

const MIN_AGE_DAYS = 3;
const BATCH_LIMIT = 100;

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun<Record<string, unknown>>(
      "approval-reminder",
      async () => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          throw new Error("Supabase env eksik");
        }

        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const cutoff = new Date(
          Date.now() - MIN_AGE_DAYS * 86_400_000
        ).toISOString();

        const { data: rows, error: queryErr } = await admin
          .from("approval_requests")
          .select("id, order_id, title, created_at")
          .eq("status", "pending")
          .is("reminded_at", null)
          .lte("created_at", cutoff)
          .order("created_at", { ascending: true })
          .limit(BATCH_LIMIT);

        if (queryErr) {
          console.error("[approval-reminder] query error:", queryErr);
          throw new Error(queryErr.message);
        }

        type Row = {
          id: string;
          order_id: string;
          title: string;
          created_at: string;
        };

        const pending = (rows ?? []) as Row[];

        if (pending.length === 0) {
          return {
            summary: "Hatırlatma gereken onay isteği yok",
            itemsProcessed: 0,
            data: { ok: true, sent: 0, skipped: 0, reason: "none_due" },
          };
        }

        const orderIds = Array.from(new Set(pending.map((r) => r.order_id)));
        const { data: orders } = await admin
          .from("orders")
          .select("id, user_id")
          .in("id", orderIds);

        const userByOrder = new Map(
          (
            (orders ?? []) as Array<{ id: string; user_id: string }>
          ).map((o) => [o.id, o.user_id])
        );

        let sent = 0;
        let skipped = 0;

        for (const row of pending) {
          const userId = userByOrder.get(row.order_id);
          if (!userId) {
            skipped++;
            continue;
          }

          const createdMs = new Date(row.created_at).getTime();
          const daysPending = Math.max(
            MIN_AGE_DAYS,
            Math.floor((Date.now() - createdMs) / 86_400_000)
          );

          const mailResult = await sendApprovalRequestReminder({
            userId,
            orderId: row.order_id,
            requestId: row.id,
            title: row.title,
            daysPending,
          });

          if (!mailResult.ok) {
            skipped++;
            continue;
          }

          const { error: markErr } = await admin
            .from("approval_requests")
            .update({ reminded_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("status", "pending")
            .is("reminded_at", null);

          if (markErr) {
            console.error(
              "[approval-reminder] reminded_at update failed:",
              markErr
            );
            skipped++;
            continue;
          }

          sent++;
        }

        return {
          summary: `${sent} hatırlatma gönderildi, ${skipped} atlandı`,
          itemsProcessed: pending.length,
          data: { ok: true, sent, skipped, batch: pending.length },
        };
      }
    );

    return NextResponse.json(payload.data ?? payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    console.error("[approval-reminder] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
