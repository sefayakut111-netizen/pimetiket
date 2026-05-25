/**
 * GET /api/admin/auditors/pending
 *
 * Onay bekleyen aksiyonların listesi. Snooze süresi dolanlar dahil.
 *
 * Query params:
 *   ?status=pending|all  (default: pending — yalnız aktif bekleyenler)
 *   ?severity=critical|warning|info  (filter)
 *   ?limit=50            (max)
 *
 * Response:
 *   { ok: true, items: AuditorPendingActionRow[] }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { unsnoozeExpiredActions } from "@/lib/agents/_shared/unsnooze";
import type { AuditorPendingActionRow } from "@/lib/agents/_shared/types";

export async function GET(req: Request) {
  const auth = await assertPermission("auditors", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const severity = url.searchParams.get("severity");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  const admin = createAdminClient();

  // Süresi dolmuş ertelenen aksiyonları bekleyen kuyruğa geri al
  await unsnoozeExpiredActions(admin);

  let query = admin
    .from("auditor_pending_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "pending") {
    query = query.eq("status", "pending");
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "pending_query_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    items: (data ?? []) as unknown as AuditorPendingActionRow[],
  });
}
