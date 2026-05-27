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
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import type { Enums } from "@/lib/supabase/types";

export const runtime = "nodejs";

const ACTIVE_STATUSES = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
] as const;

const PENDING_REVIEW_STATUSES = ["assigned", "sent"] as const;

export async function GET() {
  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();

  if (ctx.isGenericPreview) {
    return NextResponse.json({
      preview: true,
      generic: true,
      stats: {
        pending_review: 0,
        in_production: 0,
        completed_this_month: 0,
        cancelled_this_month: 0,
        issue_open: 0,
      },
      production_summary: {
        items_count: 0,
        orders_count: 0,
        product_breakdown: [],
      },
      urgent_queue: [],
      period: {
        month_start: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        ).toISOString(),
        now: now.toISOString(),
      },
    });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  // Ay başı (UTC) — istatistik referansı
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const monthStartIso = monthStart.toISOString();

  // 1) Bekleyen onay (henüz acknowledge etmedi)
  const { count: pendingReview } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .in(
      "status",
      [...PENDING_REVIEW_STATUSES] as Enums<"assignment_status">[]
    );

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
    .in("status", [...ACTIVE_STATUSES] as Enums<"assignment_status">[])
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
  type ItemRow = {
    id: string;
    order_id: string;
    title: string;
    product: string;
    qty: number;
    proof_status: string;
  };
  let urgentItems: ItemRow[] = [];
  if (urgentOrderIds.length > 0) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("id, order_id, title, product, qty, proof_status")
      .in("order_id", urgentOrderIds);
    urgentItems = (itemRows as ItemRow[] | null) ?? [];
  }

  const urgentItemIds = urgentItems.map((i) => i.id);
  const designByItem = new Map<string, string>();
  const cutlineByDesign = new Set<string>();
  if (urgentItemIds.length > 0) {
    const { data: dfRows } = await admin
      .from("design_files")
      .select("id, order_item_id")
      .in("order_item_id", urgentItemIds)
      .neq("status", "superseded")
      .order("version", { ascending: false });
    for (const df of (dfRows as Array<{ id: string; order_item_id: string }> | null) ?? []) {
      if (!designByItem.has(df.order_item_id)) {
        designByItem.set(df.order_item_id, df.id);
      }
    }
    const designIds = [...designByItem.values()];
    if (designIds.length > 0) {
      const { data: clRows } = await admin
        .from("cutline_designs")
        .select("design_file_id")
        .in("design_file_id", designIds)
        .neq("status", "superseded");
      for (const cl of (clRows as Array<{ design_file_id: string | null }> | null) ?? []) {
        if (cl.design_file_id) cutlineByDesign.add(cl.design_file_id);
      }
    }
  }

  const urgentQueue = urgent.map((u) => {
    const orderItems = urgentItems.filter((i) => i.order_id === u.order_id);
    const mappedItems = orderItems.map((it) => {
      const designFileId = designByItem.get(it.id) ?? null;
      return {
        id: it.id,
        title: it.title,
        product: it.product,
        qty: it.qty,
        proof_status: it.proof_status,
        design_file_id: designFileId,
        has_cutline: designFileId ? cutlineByDesign.has(designFileId) : false,
      };
    });
    const title =
      mappedItems.length === 1
        ? mappedItems[0].title
        : mappedItems.length > 1
          ? `${mappedItems[0].title} +${mappedItems.length - 1} ürün`
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
      assigned_at: u.assigned_at,
      estimated_delivery: u.estimated_delivery,
      hours_left: hoursLeft,
      item_count: mappedItems.length,
      items: mappedItems,
    };
  });

  return NextResponse.json({
    preview: ctx.isPreview,
    previewPartnerName: ctx.previewPartnerName ?? null,
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
