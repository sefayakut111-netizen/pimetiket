/**
 * GET /api/admin/ai-qc/history?days=30&limit=50
 *
 * Son QC operatör kararları — order_events audit trail.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

const QC_EVENT_TYPES = [
  "qc_approved",
  "qc_rejected",
  "qc_fixed_by_operator",
] as const;

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

  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await admin
    .from("order_events")
    .select(
      "order_id, event_type, summary, created_at, detail, actor_id, profiles(display_name)"
    )
    .in("event_type", [...QC_EVENT_TYPES])
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

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

  const stats = {
    approved: history.filter((h) => h.decision === "approve").length,
    rejected: history.filter((h) => h.decision === "reject").length,
    fixed: history.filter((h) => h.decision === "fix_and_proof").length,
  };

  return NextResponse.json({ ok: true, history, stats });
}
