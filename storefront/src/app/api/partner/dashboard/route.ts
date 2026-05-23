/**
 * GET /api/partner/dashboard
 *
 * Sefa 23 May v68 (Partner P2):
 * /partner ana sayfası için istatistik payload'ı.
 *
 * İstatistikler son 30 gün referans (rolling window):
 *   - pending_review: 'assigned' veya 'sent' (henüz acknowledge etmedi)
 *   - in_production: aktif üretimde
 *   - completed_this_month: shipped_at >= ay başı
 *   - cancelled_this_month: cancelled_at >= ay başı
 *   - issue_open: 'issue' (devam eden sorun)
 *
 * Üretim özeti:
 *   - items_count: kalem adet toplamı (qty)
 *   - orders_count: sipariş sayısı
 *   - product_breakdown: ürün tipi yüzdesi
 *
 * Acil sıradakiler (max 5):
 *   - estimated_delivery yakın olan aktif assignment'lar
 *
 * Auth: role='partner' (middleware zaten /partner/* için bu garantiyi
 * veriyor ama API endpoint'inde double-check güvenli).
 *
 * NOT (Sefa kuralı): partner mali bilgi GÖRMEZ — bu endpoint hiçbir
 * ₺ tutarı dönmez. items_count + orders_count + product mix yeterli.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ACTIVE_STATUSES = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
] as const;

const PENDING_REVIEW_STATUSES = ["assigned", "sent"] as const;

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profileRow as { role?: string } | null)?.role;
  if (role !== "partner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // user_id → fason_partners.id
  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("partner_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const contact = contactRow as { partner_id: string } | null;
  if (!contact) {
    return NextResponse.json(
      { error: "partner_link_missing" },
      { status: 404 }
    );
  }
  const partnerId = contact.partner_id;

  // Ay başı (UTC) — istatistik referansı
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const monthStartIso = monthStart.toISOString();

  // 1) Bekleyen onay (henüz acknowledge etmedi)
  const { count: pendingReview } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .in("status", PENDING_REVIEW_STATUSES as unknown as string[]);

  // 2) Üretimde
  const { count: inProduction } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .eq("status", "in_production");

  // 3) Bu ay tamamlanan (shipped)
  const { count: completedThisMonth } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .eq("status", "shipped")
    .gte("shipped_at", monthStartIso);

  // 4) Bu ay iptal
  const { count: cancelledThisMonth } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .eq("status", "cancelled")
    .gte("cancelled_at", monthStartIso);

  // 5) Açık sorun
  const { count: issueOpen } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .eq("status", "issue");

  // 6) Üretim özeti — bu ay shipped assignment'ların item'ları
  const { data: shippedRows } = await admin
    .from("order_assignments")
    .select("order_id")
    .eq("fason_partner_id", partnerId)
    .eq("status", "shipped")
    .gte("shipped_at", monthStartIso)
    .limit(500); // Performans guard

  type AsgRow = { order_id: string };
  const shippedOrderIds = ((shippedRows as AsgRow[] | null) ?? []).map(
    (r) => r.order_id
  );
  let itemsCount = 0;
  let productBreakdown: { product_type: string; percent: number }[] = [];
  if (shippedOrderIds.length > 0) {
    const { data: itemsRows } = await admin
      .from("order_items")
      .select("qty, product")
      .in("order_id", shippedOrderIds);
    type ItemRow = { qty: number; product: string };
    const items = (itemsRows as ItemRow[] | null) ?? [];
    itemsCount = items.reduce((sum, it) => sum + (it.qty || 0), 0);

    // Ürün tipi breakdown
    const productCount = new Map<string, number>();
    for (const it of items) {
      productCount.set(it.product, (productCount.get(it.product) ?? 0) + 1);
    }
    const total = items.length;
    productBreakdown = Array.from(productCount.entries())
      .map(([product_type, count]) => ({
        product_type,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.percent - a.percent);
  }

  // 7) Acil sıradakiler — aktif assignment'lar, estimated_delivery yakın
  const { data: urgentRows } = await admin
    .from("order_assignments")
    .select("id, order_id, estimated_delivery, status, assigned_at")
    .eq("fason_partner_id", partnerId)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .order("estimated_delivery", { ascending: true, nullsFirst: false })
    .limit(5);

  type UrgentRow = {
    id: string;
    order_id: string;
    estimated_delivery: string | null;
    status: string;
    assigned_at: string;
  };
  const urgent = (urgentRows as UrgentRow[] | null) ?? [];

  // Acil siparişlerin item başlıklarını çek
  const urgentOrderIds = urgent.map((u) => u.order_id);
  type ItemTitleRow = { order_id: string; title: string; product: string };
  let urgentItems: ItemTitleRow[] = [];
  if (urgentOrderIds.length > 0) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("order_id, title, product")
      .in("order_id", urgentOrderIds);
    urgentItems = (itemRows as ItemTitleRow[] | null) ?? [];
  }

  const urgentQueue = urgent.map((u) => {
    const items = urgentItems.filter((i) => i.order_id === u.order_id);
    const title =
      items.length === 1
        ? items[0].title
        : items.length > 1
          ? `${items[0].title} +${items.length - 1} ürün`
          : "(başlık yok)";
    const hoursLeft = u.estimated_delivery
      ? Math.round(
          (new Date(u.estimated_delivery).getTime() - now.getTime()) /
            (1000 * 60 * 60)
        )
      : null;
    return {
      assignment_id: u.id,
      order_id: u.order_id,
      title,
      status: u.status,
      estimated_delivery: u.estimated_delivery,
      hours_left: hoursLeft,
    };
  });

  return NextResponse.json({
    stats: {
      pending_review: pendingReview ?? 0,
      in_production: inProduction ?? 0,
      completed_this_month: completedThisMonth ?? 0,
      cancelled_this_month: cancelledThisMonth ?? 0,
      issue_open: issueOpen ?? 0,
    },
    production_summary: {
      items_count: itemsCount,
      orders_count: shippedOrderIds.length,
      product_breakdown: productBreakdown,
    },
    urgent_queue: urgentQueue,
    period: {
      month_start: monthStartIso,
      now: now.toISOString(),
    },
  });
}
