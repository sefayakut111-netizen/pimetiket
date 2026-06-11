/**
 * GET /api/admin/auditors
 *
 * Dashboard overview: 9 auditor için son run özeti + pending count.
 *
 * Response:
 *   {
 *     ok: true,
 *     auditors: AuditorLatestRunSummary[],
 *     pending: PendingCountSummary
 *   }
 *
 * View'ler kullanılır:
 *   - v_auditor_latest_runs (Migration 040)
 *   - v_auditor_pending_count
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { unsnoozeExpiredActions } from "@/lib/agents/_shared/unsnooze";
import {
  AUDITOR_NAMES,
  type AuditorLatestRunSummary,
  type AuditorName,
  type PendingCountSummary,
  type RunStatus,
} from "@/lib/agents/_shared/types";

interface LatestRunViewRow {
  auditor_name: string;
  latest_run_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  status: RunStatus | null;
  findings_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: string | null;
}

interface PendingCountViewRow {
  critical_pending: number | string;
  warning_pending: number | string;
  info_pending: number | string;
  total_pending: number | string;
}

export async function GET() {
  const auth = await assertPermission("auditors", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  await unsnoozeExpiredActions(admin);

  // 1) Tüm auditor'lar için son run
  const { data: runsData, error: runsErr } = await admin
    .from("v_auditor_latest_runs")
    .select(
      "auditor_name, latest_run_id, started_at, finished_at, duration_ms, status, findings_count, critical_count, warning_count, info_count, summary"
    );

  if (runsErr) {
    return NextResponse.json(
      { error: "latest_runs_failed", detail: runsErr.message },
      { status: 500 }
    );
  }

  const rows = (runsData ?? []) as unknown as LatestRunViewRow[];
  const runMap = new Map(rows.map((r) => [r.auditor_name, r]));

  // 10 agent için sıralı çıktı (boş olanlar default kayıtla)
  const auditors: AuditorLatestRunSummary[] = AUDITOR_NAMES.map(
    (name: AuditorName) => {
      const row = runMap.get(name);
      return {
        auditorName: name,
        latestRunId: row?.latest_run_id ?? null,
        startedAt: row?.started_at ?? null,
        finishedAt: row?.finished_at ?? null,
        durationMs: row?.duration_ms ?? null,
        status: row?.status ?? null,
        findingsCount: row?.findings_count ?? 0,
        criticalCount: row?.critical_count ?? 0,
        warningCount: row?.warning_count ?? 0,
        infoCount: row?.info_count ?? 0,
        summary: row?.summary ?? null,
      };
    }
  );

  // 2) Pending count
  const { data: pendingData } = await admin
    .from("v_auditor_pending_count")
    .select("critical_pending, warning_pending, info_pending, total_pending")
    .single();

  const pendingRow = pendingData as PendingCountViewRow | null;

  const pending: PendingCountSummary = {
    criticalPending: Number(pendingRow?.critical_pending ?? 0),
    warningPending: Number(pendingRow?.warning_pending ?? 0),
    infoPending: Number(pendingRow?.info_pending ?? 0),
    totalPending: Number(pendingRow?.total_pending ?? 0),
  };

  return NextResponse.json({
    ok: true,
    auditors,
    pending,
  });
}
