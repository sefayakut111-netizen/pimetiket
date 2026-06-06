/**
 * GET /api/cron/fason-deadline-reminder
 *
 * Aktif fason atamalarında estimated_delivery bugün veya yarın ise
 * partnere teslim hatırlatması gönderir. Vercel Cron: her sabah 06:00.
 *
 * Auth: CRON_SECRET Bearer header.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { enqueueMail } from "@/lib/mail/enqueue";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["assigned", "acknowledged", "in_production"] as const;
const BATCH_LIMIT = 100;

function istanbulYmd(addDays = 0): string {
  const dt = new Date(Date.now() + addDays * 86_400_000);
  return dt.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

function deliveryDateKey(value: string): string {
  return value.slice(0, 10);
}

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun<Record<string, unknown>>(
      "fason-deadline-reminder",
      async () => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          throw new Error("Supabase env eksik");
        }

        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const today = istanbulYmd(0);
        const tomorrow = istanbulYmd(1);
        const targetDates = new Set([today, tomorrow]);

        const { data: assignments, error: asgErr } = await admin
          .from("order_assignments")
          .select(
            "id, order_id, fason_partner_id, estimated_delivery, status"
          )
          .in("status", [...ACTIVE_STATUSES])
          .not("estimated_delivery", "is", null)
          .order("estimated_delivery", { ascending: true })
          .limit(BATCH_LIMIT);

        if (asgErr) {
          console.error("[fason-deadline-reminder] query error:", asgErr);
          throw new Error(asgErr.message);
        }

        type AssignmentRow = {
          id: string;
          order_id: string;
          fason_partner_id: string;
          estimated_delivery: string;
          status: string;
        };

        const dueRows = ((assignments ?? []) as AssignmentRow[]).filter((a) =>
          targetDates.has(deliveryDateKey(a.estimated_delivery))
        );

        if (dueRows.length === 0) {
          return {
            summary: "Teslim hatırlatması gereken atama yok",
            itemsProcessed: 0,
            data: { ok: true, sent: 0, skipped: 0, reason: "no_due" },
          };
        }

        const partnerIds = Array.from(
          new Set(dueRows.map((a) => a.fason_partner_id))
        );
        const { data: partners } = await admin
          .from("fason_partners")
          .select("id, name, contact_email")
          .in("id", partnerIds);

        const partnerMap = new Map(
          (
            (partners ?? []) as Array<{
              id: string;
              name: string;
              contact_email: string;
            }>
          ).map((p) => [p.id, p])
        );

        const tokenByAssignment = new Map<string, string>();

        const { data: existingMails } = await admin
          .from("fason_mail_outbox")
          .select("idempotency_key")
          .eq("template_key", "fason_deadline_reminder")
          .in(
            "idempotency_key",
            dueRows.map(
              (a) =>
                `fason_deadline:${a.id}:${deliveryDateKey(a.estimated_delivery)}`
            )
          );

        const alreadySent = new Set(
          ((existingMails ?? []) as Array<{ idempotency_key: string | null }>)
            .map((m) => m.idempotency_key)
            .filter(Boolean)
        );

        let sent = 0;
        let skipped = 0;

        for (const asg of dueRows) {
          const deliveryKey = deliveryDateKey(asg.estimated_delivery);
          const idempotencyKey = `fason_deadline:${asg.id}:${deliveryKey}`;
          if (alreadySent.has(idempotencyKey)) {
            skipped++;
            continue;
          }

          const partner = partnerMap.get(asg.fason_partner_id);
          if (!partner?.contact_email) {
            skipped++;
            continue;
          }

          const dueLabel = new Date(asg.estimated_delivery).toLocaleDateString(
            "tr-TR",
            { day: "2-digit", month: "long", year: "numeric" }
          );

          let plainToken = tokenByAssignment.get(asg.id);
          if (!plainToken) {
            const { data: issued, error: issueErr } = await admin.rpc(
              "fn_generate_fason_token",
              {
                p_assignment_id: asg.id,
                p_fason_partner_id: asg.fason_partner_id,
                p_days: 14,
              }
            );
            if (issueErr || typeof issued !== "string" || !issued) {
              console.error(
                "[fason-deadline-reminder] token issue failed:",
                asg.id,
                issueErr
              );
              skipped++;
              continue;
            }
            plainToken = issued;
            tokenByAssignment.set(asg.id, plainToken);
          }

          try {
            await enqueueMail({
              templateKey: "fason_deadline_reminder",
              to: partner.contact_email,
              category: "fason",
              targetType: "assignment",
              targetId: asg.id,
              payload: {
                order_id: asg.order_id,
                fason_name: partner.name,
                estimated_delivery: dueLabel,
                token: plainToken,
              },
              idempotencyKey,
              subject: `Hatırlatma — Sipariş ${asg.order_id} teslim tarihi yaklaşıyor (${dueLabel})`,
            });
            sent++;
          } catch (err) {
            console.error(
              "[fason-deadline-reminder] enqueue failed:",
              asg.id,
              err
            );
            skipped++;
          }
        }

        return {
          summary: `${sent} fason teslim hatırlatması gönderildi, ${skipped} atlandı`,
          itemsProcessed: sent,
          data: { ok: true, sent, skipped, total: dueRows.length },
        };
      }
    );

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/fason-deadline-reminder]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
