/**
 * GET /api/admin/auditors/runs
 *
 * Tüm auditor run'larını listele — geçmiş arama sayfası için.
 *
 * Query params:
 *   ?auditor=<name>       — filter
 *   ?status=success|failed
 *   ?since=<iso date>
 *   ?limit=50 (max 200)
 *   ?offset=0
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditorRunRow } from "@/lib/agents/_shared/types";

export async function GET(req: Request) {
  const auth = await assertPermission("auditors", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const auditor = url.searchParams.get("auditor");
  const status = url.searchParams.get("status");
  const since = url.searchParams.get("since");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const admin = createAdminClient();

  let query = admin
    .from("auditor_runs")
    .select(
      "id, auditor_name, started_at, finished_at, duration_ms, status, findings_count, critical_count, warning_count, summary",
      { count: "exact" }
    )
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (auditor) query = query.eq("auditor_name", auditor as never);
  if (status) query = query.eq("status", status as never);
  if (since) query = query.gte("started_at", since);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    runs: (data ?? []) as unknown as Partial<AuditorRunRow>[],
    total: count ?? 0,
    limit,
    offset,
  });
}
