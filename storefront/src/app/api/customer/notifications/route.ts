/**
 * GET /api/customer/notifications?limit=5
 * Müşterinin son sistem bildirimleri (order_events).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EVENT_HREF: Record<string, (orderId: string) => string> = {
  proof_ready: (id) => `/onay/${id}`,
  proof_pending: (id) => `/onay/${id}`,
  proof_approved: (id) => `/siparis/${id}`,
  design_uploaded: (id) => `/siparis/${id}`,
  design_uploaded_status_advance: (id) => `/siparis/${id}`,
  file_uploaded: (id) => `/siparis/${id}`,
  qc_flagged: (id) => `/siparis/${id}/tasarim-yukle`,
  qc_skipped_no_files: (id) => `/siparis/${id}/tasarim-yukle`,
  shipped: (id) => `/siparis/${id}`,
  delivered: (id) => `/siparis/${id}`,
  paid: (id) => `/siparis/${id}`,
};

function fallbackMessage(eventType: string, orderId: string): string {
  const short = orderId.slice(-6).toUpperCase();
  const map: Record<string, string> = {
    paid: `Sipariş #${short} ödemen alındı`,
    design_uploaded: `#${short} tasarımın yüklendi`,
    file_uploaded: `#${short} dosya yüklendi`,
    qc_passed: `#${short} AI kontrolden geçti`,
    qc_flagged: `#${short} tasarımında düzeltme gerekli`,
    proof_ready: `#${short} provan hazır — onayla`,
    proof_approved: `#${short} provayı onayladın — üretime geçildi`,
    shipped: `#${short} kargoya verildi`,
    delivered: `#${short} teslim edildi`,
    auto_refund_stale_proof: `#${short} 36 sa onay verilmedi — otomatik iade`,
  };
  return map[eventType] ?? `#${short} — sipariş güncellendi`;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(
    20,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "5"))
  );

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: events, error } = await admin
    .from("order_events")
    .select("id, event_type, summary, created_at, order_id")
    .in("order_id", orderIds)
    .eq("actor_role", "system")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications] query failed:", error);
    return NextResponse.json({ items: [] });
  }

  const items = (events ?? []).map((ev) => {
    const hrefFn = EVENT_HREF[ev.event_type];
    return {
      id: ev.id,
      type: ev.event_type,
      message: ev.summary?.trim() || fallbackMessage(ev.event_type, ev.order_id),
      createdAt: ev.created_at,
      read: false,
      href: hrefFn ? hrefFn(ev.order_id) : `/siparis/${ev.order_id}`,
    };
  });

  return NextResponse.json({ items });
}
