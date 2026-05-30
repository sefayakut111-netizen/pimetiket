/**
 * GET /api/admin/ai-qc/history?days=30&limit=50&orderId=<uuid>
 *
 * Son QC operatör kararları — order_events audit trail.
 * orderId verilirse yalnızca o siparişin karar geçmişi döner (stats atlanır).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

const QC_EVENT_TYPES = [
  "qc_approved",
  "qc_rejected",
  "qc_fixed_by_operator",
] as const;

async function computePeriodStats(
  admin: ReturnType<typeof createAdminClient>,
  sinceIso: string
) {
  const [
    approvedRes,
    rejectedRes,
    fixedRes,
    flaggedRes,
    decisionsRes,
  ] = await Promise.all([
    admin
      .from("order_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "qc_approved")
      .gte("created_at", sinceIso),
    admin
      .from("order_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "qc_rejected")
      .gte("created_at", sinceIso),
    admin
      .from("order_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "qc_fixed_by_operator")
      .gte("created_at", sinceIso),
    admin
      .from("design_quality_checks")
      .select("*", { count: "exact", head: true })
      .in("verdict", ["normal", "kotu", "error"])
      .gte("created_at", sinceIso),
    admin
      .from("order_events")
      .select("order_id, created_at")
      .in("event_type", [...QC_EVENT_TYPES])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const decisions = decisionsRes.data ?? [];
  let waitSumMs = 0;
  let waitCount = 0;

  if (decisions.length > 0) {
    const orderIds = [
      ...new Set(
        decisions
          .map((d) => d.order_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const { data: checks } = await admin
      .from("design_quality_checks")
      .select("order_id, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    const firstCheckByOrder = new Map<string, string>();
    for (const c of checks ?? []) {
      if (!c.order_id || !c.created_at) continue;
      if (!firstCheckByOrder.has(c.order_id)) {
        firstCheckByOrder.set(c.order_id, c.created_at);
      }
    }

    for (const d of decisions) {
      if (!d.order_id || !d.created_at) continue;
      const checkAt = firstCheckByOrder.get(d.order_id);
      if (!checkAt) continue;
      const waitMs =
        new Date(d.created_at).getTime() - new Date(checkAt).getTime();
      if (waitMs > 0) {
        waitSumMs += waitMs;
        waitCount++;
      }
    }
  }

  return {
    approved: approvedRes.count ?? 0,
    rejected: rejectedRes.count ?? 0,
    fixed: fixedRes.count ?? 0,
    flagged: flaggedRes.count ?? 0,
    avgWaitHours: waitCount > 0 ? waitSumMs / waitCount / 3600000 : null,
  };
}

export async function GET(req: Request) {
  const auth = await assertPermission("ai_qc", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.min(
    parseInt(url.searchParams.get("days") ?? "30", 10) || 30,
    90
  );
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    100
  );
  const orderId = url.searchParams.get("orderId")?.trim() || null;

  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  let historyQuery = admin
    .from("order_events")
    .select(
      "order_id, event_type, summary, created_at, detail, actor_id, profiles(display_name)"
    )
    .in("event_type", [...QC_EVENT_TYPES])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (orderId) {
    historyQuery = historyQuery.eq("order_id", orderId);
  }

  const { data, error } = await historyQuery;

  if (error) {
    return NextResponse.json(
      { error: "history_query_failed", detail: error.message },
      { status: 500 }
    );
  }

  type Row = {
    order_id: string;
    event_type: string;
    summary: string;
    created_at: string;
    detail: { note?: string | null } | null;
    actor_id: string | null;
    profiles: { display_name: string | null } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  const history = rows.map((row) => {
    let decision: "approve" | "reject" | "fix_and_proof" = "approve";
    if (row.event_type === "qc_rejected") decision = "reject";
    if (row.event_type === "qc_fixed_by_operator") decision = "fix_and_proof";

    return {
      orderId: row.order_id,
      decision,
      operatorName: row.profiles?.display_name ?? "Operatör",
      createdAt: row.created_at,
      note: row.detail?.note ?? null,
      summary: row.summary,
    };
  });

  if (orderId) {
    return NextResponse.json({ ok: true, history });
  }

  const periodStats = await computePeriodStats(admin, sinceIso);

  const stats = {
    approved: periodStats.approved,
    rejected: periodStats.rejected,
    fixed: periodStats.fixed,
    flagged: periodStats.flagged,
    avgWaitHours: periodStats.avgWaitHours,
  };

  return NextResponse.json({ ok: true, history, stats });
}
