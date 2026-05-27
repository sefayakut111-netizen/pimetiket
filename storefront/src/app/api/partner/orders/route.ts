/**
 * GET /api/partner/orders?status=...
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
  "ready",
] as const;

const PENDING_STATUSES = ["assigned", "sent"] as const;

type ListFilter =
  | "urgent"
  | "active"
  | "pending"
  | "completed"
  | "issue"
  | "all";

function parseFilter(raw: string | null): ListFilter {
  if (
    raw === "urgent" ||
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
      "id, order_id, status, assigned_at, estimated_delivery, is_urgent",
      { count: "exact" }
    )
    .eq("fason_partner_id", partnerId);

  switch (filter) {
    case "urgent":
      query = query.in(
        "status",
        [...ACTIVE_STATUSES] as Enums<"assignment_status">[]
      );
      break;
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
    .order("assigned_at", { ascending: true })
    .range(0, 499);

  if (error) {
    console.error("[partner/orders list]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    order_id: string;
    status: string;
    assigned_at: string | null;
    estimated_delivery: string | null;
    is_urgent?: boolean | null;
  };

  let enriched = await enrichPartnerAssignments(
    admin,
    (rows ?? []) as Row[]
  );

  if (filter === "urgent") {
    enriched = filterUrgentOnly(enriched);
  }

  enriched = sortAssignmentsForPartnerList(enriched);
  const total = filter === "urgent" ? enriched.length : count ?? enriched.length;
  const paged = enriched.slice(offset, offset + limit);

  return NextResponse.json({
    preview: ctx.isPreview,
    filter,
    assignments: paged,
    total,
    limit,
    offset,
  });
}
