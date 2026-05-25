/**
 * GET /api/admin/cart-stats
 * Son 24 saatte eklenen sepet kalemi sayısı (aktif sepet proxy).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await assertPermission("orders", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .gte("added_at", since);

  if (error) {
    console.error("[cart-stats]", error);
    return NextResponse.json({ activeCarts: 0 });
  }

  return NextResponse.json({ activeCarts: count ?? 0 });
}
