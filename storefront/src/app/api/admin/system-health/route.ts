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
import { IS_ARCHIVE_DRY_RUN } from "@/lib/storage/r2-client";
import { isResendConfigured } from "@/lib/mail/resend";

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
  let customersStatus: "ok" | "error" = "ok";
  try {
    const { error } = await admin
      .from("orders")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) dbStatus = "error";
  } catch {
    dbStatus = "error";
  }

  try {
    const { error: viewErr } = await admin
      .from("v_admin_customers")
      .select("user_id", { head: true, count: "exact" })
      .limit(1);
    if (viewErr) {
      const { error: profErr } = await admin
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("role", "customer")
        .limit(1);
      if (profErr) customersStatus = "error";
    }
  } catch {
    customersStatus = "error";
  }

  const warnings: Array<{ code: string; message: string; severity: "info" | "warn" }> =
    [];

  if (IS_ARCHIVE_DRY_RUN) {
    warnings.push({
      code: "r2_archive_dry_run",
      message:
        "R2 arşiv DRY_RUN açık — cold storage yazılmıyor. Canlı arşiv için R2_ARCHIVE_DRY_RUN=false yap.",
      severity: "warn",
    });
  }

  if (!isResendConfigured()) {
    warnings.push({
      code: "resend_not_configured",
      message: "RESEND_API_KEY tanımlı değil — e-posta bildirimleri çalışmaz.",
      severity: "warn",
    });
  }

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push({
      code: "sentry_dsn_missing",
      message: "NEXT_PUBLIC_SENTRY_DSN yok — client hata takibi kapalı.",
      severity: "info",
    });
  }

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY && !process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) {
    warnings.push({
      code: "analytics_not_configured",
      message: "PostHog ve GA4 env'leri boş — analitik consent sonrası da yüklenmez.",
      severity: "info",
    });
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
    customers: { status: customersStatus },
    warnings,
  });
}
