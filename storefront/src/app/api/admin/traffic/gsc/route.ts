/**
 * GET /api/admin/traffic/gsc
 *
 * Google Search Console — son 28 günün en çok tıklanan sorguları.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { fetchGscTopQueries } from "@/lib/seo/gsc-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("dashboard", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await fetchGscTopQueries(28);
  return NextResponse.json(result);
}
