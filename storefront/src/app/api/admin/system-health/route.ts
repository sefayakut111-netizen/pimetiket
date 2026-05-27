/**
 * GET /api/admin/system-health
 * Cron, mail ve DB durumu — dashboard strip için özet.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAutoRefundCronHealthy,
  summarizeCronHealth,
} from "@/lib/cron-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("settings", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let cronHealthy = 0;
  let cronError = 0;
  let totalCrons = 0;
  let lastError: string | undefined;
  let cronFailures: Array<{ name: string; label: string; error?: string }> = [];
  let autoRefundHealthy = false;

  try {
    const cronSummary = await summarizeCronHealth(admin);
    totalCrons = cronSummary.total;
    cronHealthy = cronSummary.healthy;
    cronError = cronSummary.error;
    lastError = cronSummary.lastError;
    cronFailures = cronSummary.failures;
    autoRefundHealthy = await isAutoRefundCronHealthy(admin);
  } catch {
    /* cron_runs yoksa veya erişim hatası — strip cron satırını nötr bırak */
  }

  let mailStatus: "ok" | "error" = "ok";
  let sent24h = 0;
  let bounce = 0;

  try {
    const { data: outbox, error } = await admin
      .from("fason_mail_outbox")
      .select("status, bounced_at")
      .gte("created_at", since)
      .limit(5000);

    if (error) {
      mailStatus = "error";
    } else {
      const rows = outbox ?? [];
      sent24h = rows.filter((r) => r.status === "sent").length;
      bounce = rows.filter((r) => Boolean(r.bounced_at)).length;
    }
  } catch {
    mailStatus = "error";
  }

  let dbStatus: "ok" | "error" = "ok";
  try {
    const { error } = await admin
      .from("orders")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) dbStatus = "error";
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json({
    ok: true,
    crons: {
      total: totalCrons,
      healthy: cronHealthy,
      error: cronError,
      lastError,
      failures: cronFailures,
    },
    autoRefundHealthy,
    mail: { status: mailStatus, sent24h, bounce },
    db: { status: dbStatus },
  });
}
