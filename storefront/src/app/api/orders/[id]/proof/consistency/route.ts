/**
 * GET /api/orders/[id]/proof/consistency
 * Çoklu tasarım tutarlılık uyarıları (order_events).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConsistencyResult } from "@/lib/proof/multi-design-check";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  if ((order as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: events } = await admin
    .from("order_events")
    .select("detail, created_at")
    .eq("order_id", orderId)
    .eq("event_type", "design_consistency_warning")
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = (events as Array<{ detail: ConsistencyResult | null }> | null)?.[0];
  const consistency = latest?.detail ?? { consistent: true, issues: [] };

  return NextResponse.json({ consistency });
}
