/**
 * GET /api/admin/shipments
 *
 * Sefa 18 May v68 (kargo paneli):
 * Tüm kargoları liste — admin /admin/kargo sayfası için.
 *
 * Query params:
 *   ?status=all|new|in_transit|out_for_delivery|delivered|failed|returned
 *           (default 'active' — delivered hariç tüm aktifler)
 *   ?carrier=yurtici (default yok = tümü)
 *   ?dateRange=today|week|month|all (default 'month')
 *   ?search=<order_id|tracking_number|customer_name> (opsiyonel)
 *   ?limit=50 (max 200)
 *   ?offset=0
 *   ?sort=recent|shipped_asc|status (default recent)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export const runtime = "nodejs";

export type ShipmentStatusFilter =
  | "all"
  | "active" // delivered + cancelled hariç
  | "new" // shipped ama henüz event yok
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned";

export interface AdminShipmentRow {
  assignment_id: string;
  order_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  tracking_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_status: string | null;
  shipped_at: string | null;
  tracking_last_polled_at: string | null;
  tracking_delivered_at: string | null;
  assignment_status: string;
  city: string | null;
  // Son event (timeline'dan)
  last_event_description: string | null;
  last_event_location: string | null;
  last_event_time: string | null;
}

function dateRangeStart(range: string): string | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case "today":
      return new Date(now - day).toISOString();
    case "week":
      return new Date(now - 7 * day).toISOString();
    case "month":
      return new Date(now - 30 * day).toISOString();
    case "all":
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ??
    "active") as ShipmentStatusFilter;
  const carrier = url.searchParams.get("carrier");
  const dateRange = url.searchParams.get("dateRange") ?? "month";
  const search = url.searchParams.get("search")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const sort = url.searchParams.get("sort") ?? "recent";

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Base query: order_assignments with shipping data
  let query = supabase
    .from("order_assignments")
    .select(
      `id, order_id, status, tracking_company, tracking_number, tracking_url,
       tracking_status, tracking_last_polled_at, tracking_delivered_at,
       shipped_at,
       orders!inner(id, user_id, address_city)`,
      { count: "exact" }
    )
    .not("tracking_number", "is", null)
    .range(offset, offset + limit - 1);

  // Status filter
  if (status === "new") {
    query = query.is("tracking_status", null).eq("status", "shipped");
  } else if (status === "active") {
    query = query.is("tracking_delivered_at", null);
  } else if (status !== "all") {
    query = query.eq("tracking_status", status);
  }

  // Carrier filter
  if (carrier) {
    query = query.ilike("tracking_company", `%${carrier}%`);
  }

  // Date range
  const startDate = dateRangeStart(dateRange);
  if (startDate) {
    query = query.gte("shipped_at", startDate);
  }

  // Search (basit — order_id veya tracking_number)
  if (search) {
    query = query.or(
      `order_id.ilike.%${search}%,tracking_number.ilike.%${search}%`
    );
  }

  // Sort
  if (sort === "shipped_asc") {
    query = query.order("shipped_at", { ascending: true });
  } else if (sort === "status") {
    query = query.order("tracking_status", { ascending: true });
  } else {
    query = query.order("shipped_at", { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type RawRow = {
    id: string;
    order_id: string;
    status: string;
    tracking_company: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    tracking_status: string | null;
    tracking_last_polled_at: string | null;
    tracking_delivered_at: string | null;
    shipped_at: string | null;
    orders: { id: string; user_id: string; address_city: string | null };
  };

  const rows = (data ?? []) as unknown as RawRow[];
  if (rows.length === 0) {
    return NextResponse.json({ shipments: [], total: count ?? 0 });
  }

  // User_id'ler için email + display_name çek (toplu)
  const userIds = Array.from(new Set(rows.map((r) => r.orders.user_id)));
  const emailMap = new Map<string, string>();
  const nameMap = new Map<string, string | null>();

  for (const uid of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    if (u?.user?.email) emailMap.set(uid, u.user.email);
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  for (const p of (profiles ?? []) as Array<{
    id: string;
    display_name: string | null;
  }>) {
    nameMap.set(p.id, p.display_name);
  }

  // Son event'leri toplu çek (her order için 1 tane)
  const orderIds = rows.map((r) => r.order_id);
  const { data: lastEvents } = await supabase
    .from("shipment_status_events")
    .select("order_id, description, location, event_time")
    .in("order_id", orderIds)
    .order("event_time", { ascending: false });

  const lastEventMap = new Map<
    string,
    { description: string | null; location: string | null; event_time: string }
  >();
  for (const ev of (lastEvents ?? []) as Array<{
    order_id: string;
    description: string | null;
    location: string | null;
    event_time: string;
  }>) {
    if (!lastEventMap.has(ev.order_id)) {
      lastEventMap.set(ev.order_id, {
        description: ev.description,
        location: ev.location,
        event_time: ev.event_time,
      });
    }
  }

  const shipments: AdminShipmentRow[] = rows.map((r) => {
    const lastEv = lastEventMap.get(r.order_id);
    return {
      assignment_id: r.id,
      order_id: r.order_id,
      user_id: r.orders.user_id,
      customer_name: nameMap.get(r.orders.user_id) ?? null,
      customer_email: emailMap.get(r.orders.user_id) ?? null,
      tracking_company: r.tracking_company,
      tracking_number: r.tracking_number,
      tracking_url: r.tracking_url,
      tracking_status: r.tracking_status,
      shipped_at: r.shipped_at,
      tracking_last_polled_at: r.tracking_last_polled_at,
      tracking_delivered_at: r.tracking_delivered_at,
      assignment_status: r.status,
      city: r.orders.address_city,
      last_event_description: lastEv?.description ?? null,
      last_event_location: lastEv?.location ?? null,
      last_event_time: lastEv?.event_time ?? null,
    };
  });

  return NextResponse.json({
    shipments,
    total: count ?? shipments.length,
  });
}
