/**
 * GET /api/admin/system-overview
 *
 * Teknik Performans & Otomasyon hub — cron, denetçi, kuyruk, otomasyon flag'leri.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemOverview } from "@/lib/system-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("settings", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const payload = await buildSystemOverview(admin);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "overview_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
