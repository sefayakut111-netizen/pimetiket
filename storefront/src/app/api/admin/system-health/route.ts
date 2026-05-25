/**
 * GET /api/admin/system-health
 * Cron, mail ve DB durumu — dashboard strip için özet.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRON_REGISTRY } from "@/lib/cron-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("settings", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const totalCrons = CRON_REGISTRY.length;
  let cronHealthy: number = totalCrons;
  let cronError = 0;
  let lastError: string | undefined;

  try {
    const { data: errorRuns } = await admin
      .from("cron_runs")
      .select("cron_name, error_message, status")
      .gte("started_at", since)
      .eq("status", "error");

    const failedNames = new Set(
      (errorRuns ?? []).map((r) => (r as { cron_name: string }).cron_name)
    );
    cronError = failedNames.size;
    cronHealthy = Math.max(0, totalCrons - cronError);
    lastError =
      (errorRuns?.[0] as { error_message?: string | null } | undefined)
        ?.error_message ?? undefined;
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
    crons: { total: totalCrons, healthy: cronHealthy, error: cronError, lastError },
    mail: { status: mailStatus, sent24h, bounce },
    db: { status: dbStatus },
  });
}
