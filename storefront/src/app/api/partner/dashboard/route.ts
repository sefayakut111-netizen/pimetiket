/**
 * GET /api/partner/dashboard
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import {
  enrichPartnerAssignments,
  filterUrgentOnly,
  sortAssignmentsForPartnerList,
} from "@/lib/fason/partner-assignment-enrich";
import type { Enums } from "@/lib/supabase/types";

export const runtime = "nodejs";

const ACTIVE_STATUSES = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
] as const;

const PENDING_REVIEW_STATUSES = ["assigned", "sent"] as const;

const EVENT_LABEL: Record<string, string> = {
  fason_acknowledged: "kabul edildi",
  fason_in_production: "üretime alındı",
  fason_ready: "hazır",
  fason_shipped: "kargoya verildi",
  shipped: "kargoya verildi",
  fason_issue_reported: "sorun bildirildi",
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / (1000 * 60 * 60));
  if (h < 1) return "Az önce";
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

export async function GET() {
  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
  const monthStartIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  if (ctx.isGenericPreview) {
    return NextResponse.json({
      preview: true,
      generic: true,
      partner_name: "Önizleme",
      stats: {
        pending: 0,
        in_production: 0,
        completed: 0,
        avg_delivery_days: null,
      },
      urgent_queue: [],
      recent_activity: [],
    });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  const { data: partnerRow } = await admin
    .from("fason_partners")
    .select("name")
    .eq("id", partnerId)
    .maybeSingle();
  const partnerName = (partnerRow as { name?: string } | null)?.name ?? "Partner";

  const { count: pending } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .in("status", [...PENDING_REVIEW_STATUSES] as Enums<"assignment_status">[]);

  const { count: inProduction } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .eq("status", "in_production");

  const { count: completed } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", partnerId)
    .eq("status", "shipped")
    .gte("shipped_at", thirtyDaysAgoIso);

  const { data: shippedForAvg } = await admin
    .from("order_assignments")
    .select("assigned_at, shipped_at")
    .eq("fason_partner_id", partnerId)
    .eq("status", "shipped")
    .gte("shipped_at", thirtyDaysAgoIso)
    .not("assigned_at", "is", null)
    .not("shipped_at", "is", null);

  let avgDeliveryDays: number | null = null;
  const shippedRows = (shippedForAvg ?? []) as Array<{
    assigned_at: string;
    shipped_at: string;
  }>;
  if (shippedRows.length > 0) {
    const totalDays = shippedRows.reduce((sum, r) => {
      return (
        sum +
        (new Date(r.shipped_at).getTime() - new Date(r.assigned_at).getTime()) /
          86400000
      );
    }, 0);
    avgDeliveryDays = Math.round((totalDays / shippedRows.length) * 10) / 10;
  }

  const { data: activeRows } = await admin
    .from("order_assignments")
    .select("id, order_id, status, assigned_at, estimated_delivery")
    .eq("fason_partner_id", partnerId)
    .in("status", [...ACTIVE_STATUSES] as Enums<"assignment_status">[]);

  const enriched = await enrichPartnerAssignments(
    admin,
    (activeRows ?? []) as Array<{
      id: string;
      order_id: string;
      status: string;
      assigned_at: string | null;
      estimated_delivery: string | null;
    }>
  );

  const urgentQueue = filterUrgentOnly(enriched).slice(0, 5);

  const { data: orderIdRows } = await admin
    .from("order_assignments")
    .select("order_id")
    .eq("fason_partner_id", partnerId)
    .order("assigned_at", { ascending: false })
    .limit(100);

  const partnerOrderIds = [
    ...new Set(
      ((orderIdRows ?? []) as Array<{ order_id: string }>).map((r) => r.order_id)
    ),
  ];

  let recentActivity: Array<{
    order_id: string;
    label: string;
    at: string;
    relative: string;
  }> = [];

  if (partnerOrderIds.length > 0) {
    const { data: events } = await admin
      .from("order_events")
      .select("order_id, event_type, summary, created_at")
      .in("order_id", partnerOrderIds)
      .in("event_type", [
        "fason_acknowledged",
        "fason_in_production",
        "fason_ready",
        "fason_shipped",
        "shipped",
        "fason_issue_reported",
      ])
      .order("created_at", { ascending: false })
      .limit(5);

    recentActivity = ((events ?? []) as Array<{
      order_id: string;
      event_type: string;
      summary: string | null;
      created_at: string;
    }>).map((e) => ({
      order_id: e.order_id,
      label:
        EVENT_LABEL[e.event_type] ??
        e.summary ??
        e.event_type.replace(/_/g, " "),
      at: e.created_at,
      relative: relativeTime(e.created_at),
    }));
  }

  return NextResponse.json({
    preview: ctx.isPreview,
    partner_name: partnerName,
    stats: {
      pending: pending ?? 0,
      in_production: inProduction ?? 0,
      completed: completed ?? 0,
      avg_delivery_days: avgDeliveryDays,
    },
    urgent_queue: urgentQueue,
    recent_activity: recentActivity,
    period: {
      rolling_start: thirtyDaysAgoIso,
      now: now.toISOString(),
    },
  });
}
