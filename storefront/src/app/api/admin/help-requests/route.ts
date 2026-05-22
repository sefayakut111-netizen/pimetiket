/**
 * GET /api/admin/help-requests
 *
 * Sefa 22 May v68 (Faz 4 — Uzman akışı):
 * Müşterilerin /onay sayfasından açtığı proof_help_requests ticket'larını
 * admin'e listele. Default: open + in_progress; ?status=all ile hepsini.
 *
 * Auth: admin gate (admin/me veya supabase admin claim).
 *
 * Response:
 *   { items: Array<{
 *       id, orderId, itemId, itemTitle, customerName, customerEmail,
 *       message, status, createdAt, ageHours, productConfig
 *     }> }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin gate — app_metadata.role veya admins tablosu üzerinden
  const admin = createAdminClient();
  const { data: adminCheck } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminCheck) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "active";
  const STATUS_FILTER: Record<string, string[] | null> = {
    active: ["open", "in_progress"],
    open: ["open"],
    resolved: ["resolved"],
    dismissed: ["dismissed"],
    all: null,
  };
  const statusFilter = STATUS_FILTER[statusParam] ?? STATUS_FILTER["active"];

  let query = admin
    .from("proof_help_requests")
    .select(
      "id, order_id, order_item_id, user_id, message, status, created_at, resolved_at, resolution_note"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (statusFilter) {
    query = query.in("status", statusFilter);
  }
  const { data: hrRows, error: hrErr } = await query;
  if (hrErr) {
    console.error("[admin/help-requests] query error:", hrErr);
    return NextResponse.json(
      { error: "query_failed", detail: hrErr.message },
      { status: 500 }
    );
  }

  type HrRow = {
    id: string;
    order_id: string;
    order_item_id: string;
    user_id: string;
    message: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
  };
  const rows = (hrRows as HrRow[] | null) ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Bulk fetch: order_items + orders + auth.users
  const itemIds = [...new Set(rows.map((r) => r.order_item_id))];
  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const [itemsRes, ordersRes] = await Promise.all([
    admin.from("order_items").select("id, title, config, qty, width, height").in("id", itemIds),
    admin.from("orders").select("id, address").in("id", orderIds),
  ]);

  // Email'i admin auth API ile çek (RLS bypass)
  const emailByUser = new Map<string, string>();
  for (const uid of userIds) {
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(uid);
      if (userRes?.user?.email) {
        emailByUser.set(uid, userRes.user.email);
      }
    } catch {
      // sessizce geç — kullanıcı silinmiş olabilir
    }
  }

  type ItemRow = {
    id: string;
    title: string;
    config: unknown;
    qty: number;
    width: number;
    height: number;
  };
  type OrderRow = {
    id: string;
    address: { name?: string } | null;
  };
  const itemMap = new Map<string, ItemRow>(
    ((itemsRes.data as ItemRow[] | null) ?? []).map((i) => [i.id, i])
  );
  const orderMap = new Map<string, OrderRow>(
    ((ordersRes.data as OrderRow[] | null) ?? []).map((o) => [o.id, o])
  );

  const now = Date.now();
  const items = rows.map((r) => {
    const it = itemMap.get(r.order_item_id);
    const ord = orderMap.get(r.order_id);
    const createdMs = new Date(r.created_at).getTime();
    return {
      id: r.id,
      orderId: r.order_id,
      itemId: r.order_item_id,
      itemTitle: it?.title ?? "(silinmiş ürün)",
      productConfig: it?.config ?? null,
      qty: it?.qty ?? 0,
      width: it?.width ?? 0,
      height: it?.height ?? 0,
      customerName: ord?.address?.name ?? null,
      customerEmail: emailByUser.get(r.user_id) ?? null,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      resolutionNote: r.resolution_note,
      ageHours: Math.round((now - createdMs) / 3_600_000),
    };
  });

  return NextResponse.json({ items });
}
