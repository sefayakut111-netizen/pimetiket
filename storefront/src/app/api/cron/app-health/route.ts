/**
 * GET /api/cron/app-health
 *
 * Uygulama sağlığı smoke denetçisi — endpoint health + sipariş anomali.
 * auditor_runs / auditor_findings'e yazar (agent=app_health).
 *
 * Schedule: vercel.json → 0 6,18 * * * (günde 2 kez UTC)
 * Auth: CRON_SECRET Bearer
 *
 * SADECE okur + raporlar — state değiştirmez.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import {
  AppHealthAuditor,
  sendDedupedAppHealthMail,
} from "@/lib/agents/auditors/app-health";
import type { Severity } from "@/lib/agents/_shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("app-health", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const auditor = new AppHealthAuditor();
      const runId = await auditor.run({
        triggerType: "cron",
        triggeredBy: "vercel-cron:app-health",
        suppressReportMail: true,
      });

      const { data: runRow } = await admin
        .from("auditor_runs")
        .select(
          "findings_count, critical_count, warning_count, info_count, summary"
        )
        .eq("id", runId)
        .maybeSingle();

      const s = runRow as {
        findings_count?: number;
        critical_count?: number;
        warning_count?: number;
        info_count?: number;
        summary?: string;
      } | null;

      let mailSent = false;
      const hasIssue =
        (s?.critical_count ?? 0) > 0 || (s?.warning_count ?? 0) > 0;

      if (hasIssue) {
        const { data: findingRows } = await admin
          .from("auditor_findings")
          .select("severity, category, title, description, data")
          .eq("run_id", runId);

        mailSent = await sendDedupedAppHealthMail(
          admin,
          runId,
          (findingRows ?? []).map((row) => ({
            category: (row as { category: string }).category,
            severity: (row as { severity: Severity }).severity,
            title: (row as { title: string }).title,
            description: (row as { description: string }).description,
            data:
              (row as { data: Record<string, unknown> | null }).data ??
              undefined,
          }))
        );
      }

      return {
        summary: s?.summary ?? "app-health tamamlandı",
        itemsProcessed: s?.findings_count ?? 0,
        data: {
          ok: true,
          runId,
          mailSent,
          findings: s?.findings_count ?? 0,
          critical: s?.critical_count ?? 0,
          warning: s?.warning_count ?? 0,
          info: s?.info_count ?? 0,
        },
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/app-health]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
