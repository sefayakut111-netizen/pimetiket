/**
 * GET /api/admin/returns
 *
 * Admin iade talepleri listesi — DB'den.
 * Query: ?status=pending|approved|rejected|refunded|all (default all)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type ReturnStatus = Enums<"return_status">;
type ReturnReason = Enums<"return_reason">;

interface DbRow {
  id: string;
  order_id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  reason: ReturnReason;
  description: string;
  attachments: string[];
  status: ReturnStatus;
  admin_note: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
}

function rowToApi(r: DbRow) {
  return {
    id: r.id,
    orderId: r.order_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    reason: r.reason,
    description: r.description,
    attachments: r.attachments ?? [],
    status: r.status,
    adminNote: r.admin_note ?? undefined,
    refundAmount:
      r.refund_amount != null ? Number(r.refund_amount) : undefined,
    createdAt: new Date(r.created_at).getTime(),
    createdAtIso: r.created_at,
    updatedAt: new Date(r.updated_at).getTime(),
    updatedAtIso: r.updated_at,
  };
}

export async function GET(req: Request) {
  const auth = await assertPermission("returns", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";

  const admin = createAdminClient();
  let query = admin
    .from("returns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    query = query.eq("status", status as ReturnStatus);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    items: ((data ?? []) as DbRow[]).map(rowToApi),
  });
}
