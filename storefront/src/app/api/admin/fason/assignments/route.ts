/**
 * GET /api/admin/fason/assignments?partnerId=<uuid>
 *
 * Bir fason ortağının atamalarını döner (sipariş özeti ile birlikte).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AssignmentRow = {
  id: string;
  order_id: string;
  fason_partner_id: string;
  status: string;
  assigned_at: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  in_production_at: string | null;
  ready_at: string | null;
  shipped_at: string | null;
  issue_category: string | null;
  issue_description: string | null;
  issue_reported_at: string | null;
  tracking_number: string | null;
  tracking_company: string | null;
  tracking_url: string | null;
};

type OrderRow = {
  id: string;
  status: string;
  total: number;
  address: { name?: string } | null;
};

export async function GET(req: Request) {
  const auth = await assertPermission("fason", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get("partnerId")?.trim() ?? "";
  if (!partnerId) {
    return NextResponse.json(
      { error: "partnerId zorunlu" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("order_assignments")
    .select(
      "id, order_id, fason_partner_id, status, assigned_at, estimated_delivery, actual_delivery, " +
        "sent_at, acknowledged_at, in_production_at, ready_at, shipped_at, " +
        "issue_category, issue_description, issue_reported_at, " +
        "tracking_number, tracking_company, tracking_url"
    )
    .eq("fason_partner_id", partnerId)
    .order("assigned_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[fason/assignments]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as AssignmentRow[];
  const orderIds = [...new Set(rows.map((r) => r.order_id))];

  const orderMap = new Map<
    string,
    { customerName: string; orderStatus: string; total: number }
  >();

  if (orderIds.length > 0) {
    const { data: orders } = await admin
      .from("orders")
      .select("id, status, total, address")
      .in("id", orderIds);

    for (const o of (orders ?? []) as OrderRow[]) {
      const addr = o.address as { name?: string } | null;
      orderMap.set(o.id, {
        customerName: addr?.name?.trim() || "—",
        orderStatus: o.status,
        total: Number(o.total),
      });
    }
  }

  const assignments = rows.map((r) => {
    const order = orderMap.get(r.order_id);
    return {
      ...r,
      customer_name: order?.customerName ?? "—",
      order_status: order?.orderStatus ?? null,
      order_total: order?.total ?? null,
    };
  });

  return NextResponse.json({ assignments });
}
