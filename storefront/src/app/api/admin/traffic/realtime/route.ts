/**
 * GET /api/admin/traffic/realtime
 *
 * GA4 Realtime API — anlık aktif kullanıcı (admin-only).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { getRealtimeSummary } from "@/lib/analytics/ga4-data-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("dashboard", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getRealtimeSummary();
  return NextResponse.json(data);
}
