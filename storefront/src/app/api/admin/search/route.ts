/**
 * GET /api/admin/search?q=
 *
 * Global admin arama — sipariş no, müşteri, kargo takip no.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LIMIT = 10;

export async function GET(req: Request) {
  const auth = await assertPermission("orders", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      orders: [],
      customers: [],
      shipments: [],
    });
  }

  const admin = createAdminClient();
  const safe = q.replace(/"/g, '""');
  const like = `%${safe}%`;

  const [ordersRes, customersRes, shipmentsRes] = await Promise.all([
    admin
      .from("orders")
      .select("id, status, total, created_at")
      .ilike("id", like)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    admin
      .from("v_admin_customers")
      .select("user_id, email, display_name, phone")
      .or(
        `email.ilike."${like}",display_name.ilike."${like}",phone.ilike."${like}"`
      )
      .limit(LIMIT),
    admin
      .from("order_assignments")
      .select("order_id, tracking_number, tracking_company, status")
      .not("tracking_number", "is", null)
      .ilike("tracking_number", like)
      .order("shipped_at", { ascending: false })
      .limit(LIMIT),
  ]);

  if (ordersRes.error || customersRes.error || shipmentsRes.error) {
    return NextResponse.json(
      {
        error:
          ordersRes.error?.message ??
          customersRes.error?.message ??
          shipmentsRes.error?.message ??
          "Query failed",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    orders: (ordersRes.data ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      href: `/admin/siparisler/${o.id}`,
      label: o.id,
      subtitle: `${o.status} · ${Number(o.total).toLocaleString("tr-TR")} ₺`,
    })),
    customers: (customersRes.data ?? []).map((c) => ({
      id: c.user_id,
      email: c.email,
      name: c.display_name,
      phone: c.phone,
      href: `/admin/musteriler/${c.user_id}`,
      label: c.display_name || c.email,
      subtitle: [c.email, c.phone].filter(Boolean).join(" · "),
    })),
    shipments: (shipmentsRes.data ?? []).map((s) => ({
      order_id: s.order_id,
      tracking_number: s.tracking_number,
      company: s.tracking_company,
      href: `/admin/siparisler/${s.order_id}`,
      label: s.tracking_number ?? "",
      subtitle: `${s.tracking_company ?? "Kargo"} · ${s.order_id}`,
    })),
  });
}
