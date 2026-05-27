/**
 * Partner assignment list enrichment — dashboard + orders API ortak mantık
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hoursUntilDelivery } from "@/lib/fason/assignment-utils";
import {
  getUrgentReason,
  resolveSlaDeadline,
  type UrgentReason,
} from "@/lib/fason/urgent-assignment";

export type PartnerAssignmentItemDto = {
  id: string;
  title: string;
  product: string;
  qty: number;
  width?: number;
  height?: number;
  proof_status: string;
  design_file_id: string | null;
  has_cutline: boolean;
};

export type PartnerAssignmentDto = {
  assignment_id: string;
  order_id: string;
  status: string;
  assigned_at: string | null;
  estimated_delivery: string | null;
  sla_deadline: string | null;
  is_urgent: boolean;
  urgent_reason: UrgentReason | null;
  hours_left: number | null;
  title: string;
  item_count: number;
  items: PartnerAssignmentItemDto[];
};

type RawAssignment = {
  id: string;
  order_id: string;
  status: string;
  assigned_at: string | null;
  estimated_delivery: string | null;
  is_urgent?: boolean | null;
};

export async function enrichPartnerAssignments(
  admin: SupabaseClient,
  rows: RawAssignment[]
): Promise<PartnerAssignmentDto[]> {
  if (rows.length === 0) return [];

  const orderIds = rows.map((r) => r.order_id);

  type ItemRow = {
    id: string;
    order_id: string;
    title: string;
    product: string;
    qty: number;
    width: number;
    height: number;
    proof_status: string;
  };

  const { data: itemRows } = await admin
    .from("order_items")
    .select("id, order_id, title, product, qty, width, height, proof_status")
    .in("order_id", orderIds);

  const items = (itemRows as ItemRow[] | null) ?? [];
  const itemIds = items.map((i) => i.id);

  const designByItem = new Map<string, string>();
  const cutlineByDesign = new Set<string>();

  if (itemIds.length > 0) {
    const { data: dfRows } = await admin
      .from("design_files")
      .select("id, order_item_id")
      .in("order_item_id", itemIds)
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

  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }

  return rows.map((a) => {
    const orderItems = itemsByOrder.get(a.order_id) ?? [];
    const mappedItems: PartnerAssignmentItemDto[] = orderItems.map((it) => {
      const designFileId = designByItem.get(it.id) ?? null;
      return {
        id: it.id,
        title: it.title,
        product: it.product,
        qty: it.qty,
        width: it.width,
        height: it.height,
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

    const sla = resolveSlaDeadline(a.estimated_delivery);
    const isUrgentFlag = a.is_urgent === true;

    return {
      assignment_id: a.id,
      order_id: a.order_id,
      status: a.status,
      assigned_at: a.assigned_at,
      estimated_delivery: a.estimated_delivery,
      sla_deadline: sla,
      is_urgent: isUrgentFlag,
      urgent_reason: getUrgentReason(isUrgentFlag, sla),
      hours_left: hoursUntilDelivery(sla),
      title,
      item_count: mappedItems.length,
      items: mappedItems,
    };
  });
}

export function sortAssignmentsForPartnerList(
  list: PartnerAssignmentDto[]
): PartnerAssignmentDto[] {
  return [...list].sort((a, b) => {
    const au = a.urgent_reason ? 1 : 0;
    const bu = b.urgent_reason ? 1 : 0;
    if (au !== bu) return bu - au;
    const at = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
    const bt = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
    return at - bt;
  });
}

export function filterUrgentOnly(list: PartnerAssignmentDto[]): PartnerAssignmentDto[] {
  return list.filter((a) => a.urgent_reason !== null);
}
