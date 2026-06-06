/**
 * GET /api/admin/operation-queue
 *
 * Birleşik operasyon kuyruğu — DB-side count + acil kayıtlar.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import {
  AI_QC_QUEUE_STATUSES,
  FASON_UNASSIGNED_STATUSES,
  PROOF_SLA_STATUSES,
  SHIPPING_STATUSES,
  emptyQueueCounts,
  formatOrderTitle,
  isTestOrderDbRow,
  proofAgeFromOrder,
  proofSlaTypeLabel,
  proofUrgency,
  sortQueueItems,
  type OperationQueueResponse,
  type QueueItem,
} from "@/lib/admin-operation-queue";

export const runtime = "nodejs";

const ITEM_LIMIT = 25;
const LIST_CAP = ITEM_LIMIT * 2;

type OrderRow = {
  id: string;
  status: string;
  address: unknown;
  created_at: string;
  sla_proof_deadline: string | null;
};

function orderSubtitle(items: Array<{ title?: string; qty?: number }>): string {
  const first = items[0];
  if (!first) return "";
  const qty = first.qty ? ` · ${first.qty} adet` : "";
  return `${first.title ?? "Ürün"}${qty}`;
}

async function fetchOrderItems(
  admin: ReturnType<typeof createAdminClient>,
  orderIds: string[]
): Promise<Map<string, Array<{ title: string; qty: number }>>> {
  const map = new Map<string, Array<{ title: string; qty: number }>>();
  if (orderIds.length === 0) return map;

  const { data } = await admin
    .from("order_items")
    .select("order_id, title, qty")
    .in("order_id", orderIds);

  for (const row of data ?? []) {
    const list = map.get(row.order_id as string) ?? [];
    list.push({
      title: row.title as string,
      qty: Number(row.qty),
    });
    map.set(row.order_id as string, list);
  }
  return map;
}

function filterTestOrders(rows: OrderRow[]): OrderRow[] {
  return rows.filter((r) => !isTestOrderDbRow(r));
}

export async function GET() {
  const auth = await assertPermission("orders", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const counts = emptyQueueCounts();
  const items: QueueItem[] = [];

  const [
    aiQcAllRowsRes,
    aiQcRowsRes,
    proofAllRowsRes,
    proofRowsRes,
    fasonCandidateRowsRes,
    assignedIdsRes,
    shippingAllRowsRes,
    shippingRowsRes,
    supportCountRes,
    supportRowsRes,
    helpCountRes,
    helpRowsRes,
    reviewCountRes,
    reviewRowsRes,
    capabilityCountRes,
    capabilityRowsRes,
  ] = await Promise.all([
    admin
      .from("orders")
      .select("id, address")
      .in("status", AI_QC_QUEUE_STATUSES as Enums<"order_status">[]),
    admin
      .from("orders")
      .select("id, status, address, created_at, sla_proof_deadline")
      .in("status", AI_QC_QUEUE_STATUSES as Enums<"order_status">[])
      .order("created_at", { ascending: true })
      .limit(ITEM_LIMIT),
    admin
      .from("orders")
      .select("id, status, address, created_at, sla_proof_deadline")
      .in("status", PROOF_SLA_STATUSES as Enums<"order_status">[]),
    admin
      .from("orders")
      .select("id, status, address, created_at, sla_proof_deadline")
      .in("status", PROOF_SLA_STATUSES as Enums<"order_status">[])
      .order("created_at", { ascending: true })
      .limit(ITEM_LIMIT),
    admin
      .from("orders")
      .select("id, status, address, created_at, sla_proof_deadline")
      .in("status", FASON_UNASSIGNED_STATUSES as Enums<"order_status">[]),
    admin
      .from("order_assignments")
      .select("order_id")
      .neq("status", "cancelled"),
    admin
      .from("order_assignments")
      .select(
        "order_id, tracking_number, orders!inner(id, status, address, created_at, sla_proof_deadline)"
      )
      .is("tracking_number", null)
      .neq("status", "cancelled")
      .in("orders.status", SHIPPING_STATUSES as Enums<"order_status">[]),
    admin
      .from("order_assignments")
      .select(
        "order_id, tracking_number, orders!inner(id, status, address, created_at, sla_proof_deadline)"
      )
      .is("tracking_number", null)
      .neq("status", "cancelled")
      .in("orders.status", SHIPPING_STATUSES as Enums<"order_status">[])
      .order("assigned_at", { ascending: true })
      .limit(ITEM_LIMIT),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "waiting_customer"]),
    admin
      .from("support_tickets")
      .select("id, subject, status, guest_name, created_at")
      .in("status", ["open", "in_progress", "waiting_customer"])
      .order("created_at", { ascending: true })
      .limit(ITEM_LIMIT),
    admin
      .from("proof_help_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    admin
      .from("proof_help_requests")
      .select("id, order_id, message, status, created_at")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(ITEM_LIMIT),
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("reviews")
      .select("id, title, display_name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(ITEM_LIMIT),
    admin
      .from("partner_capabilities")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    admin
      .from("partner_capabilities")
      .select("id, capability_type, capability_value, created_at, partner_id")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true })
      .limit(ITEM_LIMIT),
  ]);

  const assignedOrderIds = new Set(
    (assignedIdsRes.data ?? []).map((r) => r.order_id as string)
  );

  const aiQcRows = filterTestOrders((aiQcRowsRes.data ?? []) as OrderRow[]);
  counts.ai_qc = filterTestOrders(
    (aiQcAllRowsRes.data ?? []) as OrderRow[]
  ).length;

  const proofAllRows = filterTestOrders(
    (proofAllRowsRes.data ?? []) as OrderRow[]
  );
  const proofRowsRaw = filterTestOrders((proofRowsRes.data ?? []) as OrderRow[]);
  counts.proof_sla = proofAllRows.length;

  const fasonRows = filterTestOrders(
    ((fasonCandidateRowsRes.data ?? []) as OrderRow[]).filter(
      (o) => !assignedOrderIds.has(o.id)
    )
  );
  counts.fason_unassigned = fasonRows.length;

  type ShippingJoinRow = {
    order_id: string;
    tracking_number: string | null;
    orders: OrderRow;
  };
  const shippingAllRows = ((shippingAllRowsRes.data ?? []) as ShippingJoinRow[])
    .filter((r) => r.orders && !isTestOrderDbRow(r.orders));
  const shippingRows = shippingAllRows.slice(0, ITEM_LIMIT);
  counts.shipping = shippingAllRows.length;

  counts.support =
    (supportCountRes.count ?? 0) + (helpCountRes.count ?? 0);
  counts.review = reviewCountRes.count ?? 0;
  counts.capability = capabilityCountRes.count ?? 0;

  const criticalCount = proofAllRows.filter(
    (o) => proofUrgency(proofAgeFromOrder(o).ageHours) === "critical"
  ).length;

  const orderIdsForItems = [
    ...aiQcRows.map((o) => o.id),
    ...proofRowsRaw.map((o) => o.id),
    ...fasonRows.slice(0, ITEM_LIMIT).map((o) => o.id),
    ...shippingRows.map((r) => r.orders.id),
  ];
  const itemMap = await fetchOrderItems(admin, [...new Set(orderIdsForItems)]);

  for (const o of aiQcRows) {
    const ageHours = (Date.now() - new Date(o.created_at).getTime()) / 3_600_000;
    items.push({
      id: `${o.id}-ai_qc`,
      type: "ai_qc",
      title: formatOrderTitle(o.id, o.address),
      subtitle: orderSubtitle(itemMap.get(o.id) ?? []),
      urgency: ageHours > 24 ? "warning" : "normal",
      ageHours,
      href: `/admin/ai-qc?order=${o.id}`,
      actionLabel: "İncele",
    });
  }

  for (const o of proofRowsRaw) {
    const { ageHours, deadline } = proofAgeFromOrder(o);
    const urgency =
      o.status === "proof_pending" || o.status === "operator_print_review"
        ? proofUrgency(ageHours)
        : ageHours > 12
          ? "warning"
          : "normal";
    const productLine = orderSubtitle(itemMap.get(o.id) ?? []);
    items.push({
      id: `${o.id}-proof_sla`,
      type: "proof_sla",
      title: formatOrderTitle(o.id, o.address),
      subtitle: productLine
        ? `${proofSlaTypeLabel(o.status)} · ${productLine}`
        : proofSlaTypeLabel(o.status),
      urgency,
      ageHours,
      deadline,
      href: `/admin/prova?order=${o.id}`,
      actionLabel:
        urgency === "critical" && o.status === "proof_pending"
          ? "Hatırlat"
          : "Görüntüle",
    });
  }

  for (const o of fasonRows.slice(0, ITEM_LIMIT)) {
    const ageHours = (Date.now() - new Date(o.created_at).getTime()) / 3_600_000;
    items.push({
      id: `${o.id}-fason`,
      type: "fason_unassigned",
      title: formatOrderTitle(o.id, o.address),
      subtitle: orderSubtitle(itemMap.get(o.id) ?? []),
      urgency: ageHours > 48 ? "warning" : "normal",
      ageHours,
      href: `/admin/fason?assign=${o.id}`,
      actionLabel: "Ata",
    });
  }

  for (const r of shippingRows) {
    const o = r.orders;
    const ageHours = (Date.now() - new Date(o.created_at).getTime()) / 3_600_000;
    items.push({
      id: `${o.id}-shipping`,
      type: "shipping",
      title: formatOrderTitle(o.id, o.address),
      subtitle: orderSubtitle(itemMap.get(o.id) ?? []),
      urgency: ageHours > 72 ? "warning" : "normal",
      ageHours,
      href: `/admin/kargo/${o.id}`,
      actionLabel: "Etiket bas",
    });
  }

  const now = Date.now();
  for (const t of supportRowsRes.data ?? []) {
    const ageHours = (now - new Date(t.created_at as string).getTime()) / 3_600_000;
    items.push({
      id: `support-${t.id as string}`,
      type: "support",
      title: (t.guest_name as string | null)
        ? `${t.guest_name as string} — ${t.subject as string}`
        : (t.subject as string),
      urgency: ageHours > 24 ? "warning" : "normal",
      ageHours,
      href: `/admin/destek?ticket=${t.id as string}`,
      actionLabel: "Yanıtla",
    });
  }

  for (const h of helpRowsRes.data ?? []) {
    const ageHours = (now - new Date(h.created_at as string).getTime()) / 3_600_000;
    items.push({
      id: `help-${h.id as string}`,
      type: "support",
      title: `#${h.order_id as string} — prova yardımı`,
      subtitle: ((h.message as string) ?? "").slice(0, 80),
      urgency: ageHours > 12 ? "warning" : "normal",
      ageHours,
      href: `/admin/destek?tab=yardim&help=${h.id as string}`,
      actionLabel: "Yanıtla",
    });
  }

  for (const r of reviewRowsRes.data ?? []) {
    const ageHours = (now - new Date(r.created_at as string).getTime()) / 3_600_000;
    items.push({
      id: `review-${r.id as string}`,
      type: "review",
      title: (r.display_name as string | null)
        ? `${r.display_name as string} — yorum`
        : (r.title as string | null) ?? "Onay bekleyen yorum",
      urgency: "normal",
      ageHours,
      href: `/admin/yorumlar`,
      actionLabel: "Onayla",
    });
  }

  const partnerIds = [
    ...new Set(
      (capabilityRowsRes.data ?? []).map((c) => c.partner_id as string)
    ),
  ];
  const partnerNameById = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await admin
      .from("fason_partners")
      .select("id, name")
      .in("id", partnerIds);
    for (const p of partners ?? []) {
      partnerNameById.set(p.id as string, p.name as string);
    }
  }

  for (const c of capabilityRowsRes.data ?? []) {
    const ageHours =
      (now - new Date((c.created_at as string | null) ?? new Date().toISOString()).getTime()) /
      3_600_000;
    const partnerName = partnerNameById.get(c.partner_id as string) ?? "Partner";
    items.push({
      id: `cap-${c.id as string}`,
      type: "capability",
      title: `${partnerName} — ${c.capability_type as string}`,
      subtitle: c.capability_value as string,
      urgency: "normal",
      ageHours,
      href: `/admin/fason/${c.partner_id as string}`,
      actionLabel: "Onayla",
    });
  }

  const sorted = sortQueueItems(items).slice(0, LIST_CAP);

  const response: OperationQueueResponse = {
    counts,
    criticalCount,
    items: sorted,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
