/**
 * GET /api/admin/shipments/stats
 *
 * Sefa 18 May v68 (kargo paneli KPI):
 * Kargo dashboard üst kısımdaki KPI kartları için özet veri.
 *
 * Response:
 *   {
 *     shipped_today: 12,
 *     in_transit: 47,           // tracking_status='in_transit'
 *     out_for_delivery: 8,      // tracking_status='out_for_delivery'
 *     delivered_this_week: 34,
 *     failed_recent: 2,         // son 7 gün failed+returned (alarm için)
 *     pending_no_event: 5,      // shipped ama hiç event çekememiş (sorun göstergesi)
 *     avg_fulfillment_days: 2.3,// ortalama teslim süresi (shipped → delivered)
 *     success_rate: 96,         // (delivered) / (delivered + failed + returned) * 100
 *     last_poll: "2026-05-18T14:32:00Z",
 *     daily_trend: [{day, count}, ...]  // son 14 gün, line chart için
 *   }
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export const runtime = "nodejs";

export interface ShipmentStats {
  shipped_today: number;
  in_transit: number;
  out_for_delivery: number;
  delivered_this_week: number;
  failed_recent: number;
  pending_no_event: number;
  avg_fulfillment_days: number | null;
  success_rate: number | null;
  last_poll: string | null;
  daily_trend: Array<{ day: string; shipped: number; delivered: number }>;
  /** Faz 3: teslim süresi histogram bucket'ları */
  delivery_histogram: Array<{ bucket: string; count: number }>;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const today = new Date(now.getTime() - day).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * day).toISOString();
  const fortnightAgo = new Date(now.getTime() - 14 * day).toISOString();

  // 1. Shipped today
  const { count: shippedToday } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .gte("shipped_at", today)
    .not("tracking_number", "is", null);

  // 2. In transit
  const { count: inTransit } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("tracking_status", "in_transit");

  // 3. Out for delivery
  const { count: outForDelivery } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("tracking_status", "out_for_delivery");

  // 4. Delivered this week
  const { count: deliveredThisWeek } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .gte("tracking_delivered_at", weekAgo);

  // 5. Failed/returned son 7 günde
  const { count: failedRecent } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .in("tracking_status", ["failed", "returned"])
    .gte("shipped_at", weekAgo);

  // 6. Pending no event (shipped ama hiç event çekememiş)
  const { count: pendingNoEvent } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .not("tracking_number", "is", null)
    .is("tracking_status", null)
    .is("tracking_delivered_at", null)
    .gte("shipped_at", weekAgo);

  // 7. Ortalama teslim süresi (son 30 günde)
  const monthAgo = new Date(now.getTime() - 30 * day).toISOString();
  const { data: deliveredRows } = await supabase
    .from("order_assignments")
    .select("shipped_at, tracking_delivered_at")
    .not("tracking_delivered_at", "is", null)
    .gte("tracking_delivered_at", monthAgo);

  let avgFulfillmentDays: number | null = null;
  if (deliveredRows && deliveredRows.length > 0) {
    const totalDays = (
      deliveredRows as Array<{
        shipped_at: string;
        tracking_delivered_at: string;
      }>
    ).reduce((s, r) => {
      const ship = new Date(r.shipped_at).getTime();
      const deliv = new Date(r.tracking_delivered_at).getTime();
      return s + (deliv - ship) / day;
    }, 0);
    avgFulfillmentDays = Math.round((totalDays / deliveredRows.length) * 10) / 10;
  }

  // 8. Success rate (son 30 gün)
  const { count: deliveredCount } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .not("tracking_delivered_at", "is", null)
    .gte("tracking_delivered_at", monthAgo);

  const { count: failedCount } = await supabase
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .in("tracking_status", ["failed", "returned"])
    .gte("shipped_at", monthAgo);

  const totalCompleted = (deliveredCount ?? 0) + (failedCount ?? 0);
  const successRate =
    totalCompleted > 0
      ? Math.round(((deliveredCount ?? 0) / totalCompleted) * 100)
      : null;

  // 9. Son poll zamanı
  const { data: lastPollRow } = await supabase
    .from("order_assignments")
    .select("tracking_last_polled_at")
    .not("tracking_last_polled_at", "is", null)
    .order("tracking_last_polled_at", { ascending: false })
    .limit(1);

  const lastPoll =
    (lastPollRow?.[0] as { tracking_last_polled_at: string } | undefined)
      ?.tracking_last_polled_at ?? null;

  // 10. Son 14 gün günlük trend
  const { data: trendRows } = await supabase
    .from("order_assignments")
    .select("shipped_at, tracking_delivered_at")
    .gte("shipped_at", fortnightAgo);

  const trendMap = new Map<string, { shipped: number; delivered: number }>();
  // 14 günü 0'la init
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toISOString().split("T")[0];
    trendMap.set(key, { shipped: 0, delivered: 0 });
  }

  for (const row of (trendRows ?? []) as Array<{
    shipped_at: string;
    tracking_delivered_at: string | null;
  }>) {
    const shipDay = row.shipped_at.split("T")[0];
    if (trendMap.has(shipDay)) {
      trendMap.get(shipDay)!.shipped += 1;
    }
    if (row.tracking_delivered_at) {
      const delivDay = row.tracking_delivered_at.split("T")[0];
      if (trendMap.has(delivDay)) {
        trendMap.get(delivDay)!.delivered += 1;
      }
    }
  }

  const dailyTrend = Array.from(trendMap.entries()).map(([day, counts]) => ({
    day,
    shipped: counts.shipped,
    delivered: counts.delivered,
  }));

  // 11. Teslim süresi histogram (son 90 gün, delivered olanlar)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * day).toISOString();
  const { data: histRows } = await supabase
    .from("order_assignments")
    .select("shipped_at, tracking_delivered_at")
    .not("tracking_delivered_at", "is", null)
    .gte("tracking_delivered_at", ninetyDaysAgo);

  // Bucket'lar: 0-1, 1-2, 2-3, 3-4, 4-5, 5-7, 7+
  const buckets = [
    { bucket: "0-1", min: 0, max: 1, count: 0 },
    { bucket: "1-2", min: 1, max: 2, count: 0 },
    { bucket: "2-3", min: 2, max: 3, count: 0 },
    { bucket: "3-4", min: 3, max: 4, count: 0 },
    { bucket: "4-5", min: 4, max: 5, count: 0 },
    { bucket: "5-7", min: 5, max: 7, count: 0 },
    { bucket: "7+", min: 7, max: 9999, count: 0 },
  ];

  for (const row of (histRows ?? []) as Array<{
    shipped_at: string;
    tracking_delivered_at: string;
  }>) {
    const days =
      (new Date(row.tracking_delivered_at).getTime() -
        new Date(row.shipped_at).getTime()) /
      day;
    if (days < 0) continue;
    const b = buckets.find((b) => days >= b.min && days < b.max);
    if (b) b.count++;
  }

  const deliveryHistogram = buckets.map((b) => ({
    bucket: b.bucket,
    count: b.count,
  }));

  const stats: ShipmentStats = {
    shipped_today: shippedToday ?? 0,
    in_transit: inTransit ?? 0,
    out_for_delivery: outForDelivery ?? 0,
    delivered_this_week: deliveredThisWeek ?? 0,
    failed_recent: failedRecent ?? 0,
    pending_no_event: pendingNoEvent ?? 0,
    avg_fulfillment_days: avgFulfillmentDays,
    success_rate: successRate,
    last_poll: lastPoll,
    daily_trend: dailyTrend,
    delivery_histogram: deliveryHistogram,
  };

  return NextResponse.json(stats);
}
