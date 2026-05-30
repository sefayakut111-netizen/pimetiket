/**
 * GET /api/admin/dashboard-aggregate
 *
 * Dashboard grafik/metrik agregasyonu — 500 sipariş limiti yok.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDashboardRangeWindow,
  type DashboardTimeRange,
} from "@/lib/admin-dashboard-range";
import { computeDashboardAggregate } from "@/lib/dashboard-aggregate-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await assertPermission("dashboard", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "7d";
  const range = (
    ["today", "7d", "mtd", "30d", "custom"].includes(rangeParam)
      ? rangeParam
      : "7d"
  ) as DashboardTimeRange;
  const customFrom = url.searchParams.get("from") ?? undefined;
  const customTo = url.searchParams.get("to") ?? undefined;
  const excludeTest = url.searchParams.get("excludeTest") !== "0";

  const rangeWindow = getDashboardRangeWindow(range, customFrom, customTo);

  try {
    const admin = createAdminClient();
    const aggregate = await computeDashboardAggregate(
      admin,
      rangeWindow,
      excludeTest
    );
    return NextResponse.json({
      ok: true,
      range,
      rangeWindow: {
        days: rangeWindow.days,
        start: new Date(rangeWindow.start).toISOString(),
        end: rangeWindow.end
          ? new Date(rangeWindow.end).toISOString()
          : null,
      },
      ...aggregate,
    });
  } catch (e) {
    console.error("[dashboard-aggregate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Aggregate failed" },
      { status: 500 }
    );
  }
}
