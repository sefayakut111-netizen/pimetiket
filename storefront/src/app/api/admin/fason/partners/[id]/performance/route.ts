/**
 * GET /api/admin/fason/partners/[id]/performance
 *
 * v_fason_performance + cached_score + atama istatistikleri.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data: partner, error: pErr } = await admin
    .from("fason_partners")
    .select("id, name, cached_score, score_updated_at")
    .eq("id", id)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!partner) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const { data: perf, error: perfErr } = await admin
    .from("v_fason_performance")
    .select(
      "on_time_rate, avg_response_hours, issue_rate, return_rate, " +
        "shipped_count, cancelled_count, issue_count, total_assignments, " +
        "last_assigned_at"
    )
    .eq("fason_id", id)
    .maybeSingle();

  if (perfErr) {
    return NextResponse.json({ error: perfErr.message }, { status: 500 });
  }

  const { count: activeCount } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", id)
    .in("status", ["assigned", "acknowledged", "in_production", "sent", "ready", "issue"]);

  const row = partner as {
    cached_score: number | null;
    score_updated_at: string | null;
    name: string;
  };
  const perfRow = (perf ?? {}) as {
    on_time_rate?: number | null;
    avg_response_hours?: number | null;
    issue_rate?: number | null;
    return_rate?: number | null;
    shipped_count?: number | null;
    cancelled_count?: number | null;
    issue_count?: number | null;
    total_assignments?: number | null;
    last_assigned_at?: string | null;
  };

  return NextResponse.json({
    partnerId: id,
    partnerName: row.name,
    cached_score: row.cached_score,
    score_updated_at: row.score_updated_at,
    on_time_rate: perfRow.on_time_rate ?? null,
    avg_response_hours: perfRow.avg_response_hours ?? null,
    issue_rate: perfRow.issue_rate ?? null,
    return_rate: perfRow.return_rate ?? null,
    shipped_count: perfRow.shipped_count ?? 0,
    cancelled_count: perfRow.cancelled_count ?? 0,
    issue_count: perfRow.issue_count ?? 0,
    total_assignments: perfRow.total_assignments ?? 0,
    active_assignments: activeCount ?? 0,
    last_assigned_at: perfRow.last_assigned_at ?? null,
  });
}
