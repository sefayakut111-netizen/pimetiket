/**
 * GET /api/partner/orders?status=active|pending|completed|issue|all&limit=&offset=
 *
 * Partner atama listesi — indirme metadata ile birlikte.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import { hoursUntilDelivery } from "@/lib/fason/assignment-utils";
import type { Enums } from "@/lib/supabase/types";

export const runtime = "nodejs";

const ACTIVE_STATUSES = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
] as const;

const PENDING_STATUSES = ["assigned", "sent"] as const;

type ListFilter = "active" | "pending" | "completed" | "issue" | "all";

function parseFilter(raw: string | null): ListFilter {
  if (
    raw === "active" ||
    raw === "pending" ||
    raw === "completed" ||
    raw === "issue" ||
    raw === "all"
  ) {
    return raw;
  }
  return "active";
}

export async function GET(req: Request) {
  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filter = parseFilter(searchParams.get("status"));
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
    100
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  if (ctx.isGenericPreview) {
    return NextResponse.json({
      preview: true,
      generic: true,
      filter,
      assignments: [],
      total: 0,
    });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  let query = admin
    .from("order_assignments")
    .select(
      "id, order_id, status, assigned_at, estimated_delivery, in_production_at, ready_at, shipped_at",
      { count: "exact" }
    )
    .eq("fason_partner_id", partnerId);

  switch (filter) {
    case "active":
      query = query.in(
        "status",
        [...ACTIVE_STATUSES] as Enums<"assignment_status">[]
      );
      break;
    case "pending":
      query = query.in(
        "status",
        [...PENDING_STATUSES] as Enums<"assignment_status">[]
      );
      break;
    case "completed":
      query = query.eq("status", "shipped");
      break;
    case "issue":
      query = query.eq("status", "issue");
      break;
    case "all":
      break;
  }

  const { data: rows, count, error } = await query
    .order("estimated_delivery", { ascending: true, nullsFirst: false })
    .order("assigned_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[partner/orders list]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type AsgRow = {
    id: string;
    order_id: string;
    status: string;
    assigned_at: string | null;
    estimated_delivery: string | null;
    in_production_at: string | null;
    ready_at: string | null;
    shipped_at: string | null;
  };
  const assignments = (rows as AsgRow[] | null) ?? [];
  const orderIds = assignments.map((a) => a.order_id);

  type ItemRow = {
    id: string;
    order_id: string;
    title: string;
    product: string;
    qty: number;
    proof_status: string;
  };
  let items: ItemRow[] = [];
  if (orderIds.length > 0) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("id, order_id, title, product, qty, proof_status")
      .in("order_id", orderIds);
    items = (itemRows as ItemRow[] | null) ?? [];
  }

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

  const result = assignments.map((a) => {
    const orderItems = itemsByOrder.get(a.order_id) ?? [];
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

    return {
      assignment_id: a.id,
      order_id: a.order_id,
      status: a.status,
      assigned_at: a.assigned_at,
      estimated_delivery: a.estimated_delivery,
      in_production_at: a.in_production_at,
      ready_at: a.ready_at,
      shipped_at: a.shipped_at,
      hours_left: hoursUntilDelivery(a.estimated_delivery),
      title,
      item_count: mappedItems.length,
      items: mappedItems,
    };
  });

  return NextResponse.json({
    preview: ctx.isPreview,
    filter,
    assignments: result,
    total: count ?? result.length,
    limit,
    offset,
  });
}
