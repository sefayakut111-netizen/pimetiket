/**
 * GET /api/admin/auditors/[name]
 *
 * Tek auditor için detay sayfası verisi:
 *   - Son run özeti
 *   - Son 30 günde yapılan run'ların listesi (trend)
 *   - Son run'ın finding'leri
 *   - Bu auditor'a ait pending action'lar
 *
 * Query params:
 *   ?runId=<uuid>  → spesifik bir run'ı yükle (default: en son)
 *
 * Response:
 *   {
 *     ok: true,
 *     auditor: "security",
 *     latestRunId: string,
 *     latestRun: AuditorRunRow,
 *     recentRuns: AuditorRunRow[],   // son 30 gün, max 100
 *     findings: AuditorFindingRow[],
 *     pendingActions: AuditorPendingActionRow[]
 *   }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import {
  AUDITOR_NAMES,
  type AuditorName,
  type AuditorFindingRow,
  type AuditorPendingActionRow,
  type AuditorRunRow,
} from "@/lib/agents/_shared/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await params;
  if (!(AUDITOR_NAMES as readonly string[]).includes(name)) {
    return NextResponse.json(
      { error: "unknown_auditor", name },
      { status: 404 }
    );
  }
  const auditorName = name as AuditorName;

  const url = new URL(req.url);
  const runIdParam = url.searchParams.get("runId");

  const admin = createAdminClient();

  // 1) Son 30 gün run listesi (trend için)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentRunsData } = await admin
    .from("auditor_runs")
    .select("*")
    .eq("auditor_name", auditorName as never)
    .gte("started_at", thirtyDaysAgo.toISOString())
    .order("started_at", { ascending: false })
    .limit(100);

  const recentRuns = (recentRunsData ?? []) as unknown as AuditorRunRow[];

  // 2) Gösterilecek run — explicit runId veya en sonuncusu
  let latestRun: AuditorRunRow | null = null;
  if (runIdParam) {
    const { data } = await admin
      .from("auditor_runs")
      .select("*")
      .eq("id", runIdParam)
      .eq("auditor_name", auditorName as never)
      .maybeSingle();
    latestRun = (data ?? null) as unknown as AuditorRunRow | null;
  } else {
    latestRun = recentRuns[0] ?? null;
  }

  // 3) Bu run'ın finding'leri
  let findings: AuditorFindingRow[] = [];
  if (latestRun) {
    const { data: findingData } = await admin
      .from("auditor_findings")
      .select("*")
      .eq("run_id", latestRun.id)
      .order("severity", { ascending: true })
      .order("created_at", { ascending: false });

    findings = (findingData ?? []) as unknown as AuditorFindingRow[];
  }

  // 4) Bu auditor'a ait pending actions (son 30 gün)
  const { data: pendingData } = await admin
    .from("auditor_pending_actions")
    .select("*")
    .eq("auditor_name", auditorName as never)
    .order("created_at", { ascending: false })
    .limit(50);

  const pendingActions = (pendingData ??
    []) as unknown as AuditorPendingActionRow[];

  return NextResponse.json({
    ok: true,
    auditor: auditorName,
    latestRunId: latestRun?.id ?? null,
    latestRun,
    recentRuns,
    findings,
    pendingActions,
  });
}
