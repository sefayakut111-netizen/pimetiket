/**
 * GET /api/admin/partner-production-summary
 * Aktif üretim atamaları — partner bazlı özet.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["assigned", "acknowledged", "in_production"] as const;

export async function GET() {
  const auth = await assertPermission("fason", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("order_assignments")
    .select(
      `
      id,
      status,
      estimated_delivery,
      fason_partners ( name )
    `
    )
    .in("status", [...ACTIVE_STATUSES]);

  if (error) {
    console.error("[partner-production-summary]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const map = new Map<
    string,
    { name: string; activeCount: number; overdueCount: number }
  >();

  for (const row of data ?? []) {
    const partner = row.fason_partners as { name?: string } | null;
    const name = partner?.name ?? "Bilinmeyen partner";
    const entry = map.get(name) ?? {
      name,
      activeCount: 0,
      overdueCount: 0,
    };
    entry.activeCount += 1;
    const eta = row.estimated_delivery as string | null;
    if (eta && eta < now) {
      entry.overdueCount += 1;
    }
    map.set(name, entry);
  }

  const partners = Array.from(map.values())
    .sort((a, b) => b.activeCount - a.activeCount)
    .slice(0, 5);

  return NextResponse.json({
    ok: true,
    partners,
    totals: {
      active: partners.reduce((s, p) => s + p.activeCount, 0),
      overdue: partners.reduce((s, p) => s + p.overdueCount, 0),
    },
  });
}
