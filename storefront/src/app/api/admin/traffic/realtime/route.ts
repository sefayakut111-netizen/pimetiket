/**
 * GET /api/admin/traffic/realtime
 *
 * GA4 Realtime API — anlık aktif kullanıcı (admin-only).
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { getRealtimeSummary } from "@/lib/analytics/ga4-data-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getRealtimeSummary();
  return NextResponse.json(data);
}
