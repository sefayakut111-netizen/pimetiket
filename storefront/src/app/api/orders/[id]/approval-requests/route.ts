/**
 * GET /api/orders/[id]/approval-requests
 * Müşteri: kendi siparişinin onay görseli istekleri + signed URL'ler.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createApprovalAssetSignedUrl } from "@/lib/approvals/approval-storage";

export const runtime = "nodejs";

type ApprovalRow = {
  id: string;
  order_id: string;
  order_item_id: string | null;
  source: string;
  partner_id: string | null;
  title: string;
  message: string | null;
  blocking: boolean;
  status: string;
  customer_comment: string | null;
  decided_at: string | null;
  created_at: string;
};

type AssetRow = {
  id: string;
  request_id: string;
  storage_path: string;
  mime: string;
  sort: number;
};

function statusSortRank(status: string): number {
  return status === "pending" ? 0 : 1;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orderRow } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as { id: string; user_id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: requests, error: reqErr } = await admin
    .from("approval_requests")
    .select(
      "id, order_id, order_item_id, source, partner_id, title, message, blocking, status, customer_comment, decided_at, created_at"
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (reqErr) {
    console.error("[approval-requests] list failed:", reqErr);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const rows = (requests ?? []) as ApprovalRow[];
  rows.sort(
    (a, b) =>
      statusSortRank(a.status) - statusSortRank(b.status) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const requestIds = rows.map((r) => r.id);
  let assets: AssetRow[] = [];
  if (requestIds.length > 0) {
    const { data: assetRows, error: assetErr } = await admin
      .from("approval_assets")
      .select("id, request_id, storage_path, mime, sort")
      .in("request_id", requestIds)
      .order("sort", { ascending: true });
    if (assetErr) {
      console.error("[approval-requests] assets list failed:", assetErr);
      return NextResponse.json({ error: "assets_failed" }, { status: 500 });
    }
    assets = (assetRows ?? []) as AssetRow[];
  }

  const assetsByRequest = new Map<string, AssetRow[]>();
  for (const a of assets) {
    const list = assetsByRequest.get(a.request_id) ?? [];
    list.push(a);
    assetsByRequest.set(a.request_id, list);
  }

  const payload = await Promise.all(
    rows.map(async (r) => {
      const reqAssets = assetsByRequest.get(r.id) ?? [];
      const withUrls = await Promise.all(
        reqAssets.map(async (a) => ({
          id: a.id,
          mime: a.mime,
          sort: a.sort,
          url: await createApprovalAssetSignedUrl(admin, a.storage_path),
        }))
      );
      return {
        id: r.id,
        order_item_id: r.order_item_id,
        source: r.source,
        title: r.title,
        message: r.message,
        blocking: r.blocking,
        status: r.status,
        customer_comment: r.customer_comment,
        decided_at: r.decided_at,
        created_at: r.created_at,
        assets: withUrls,
      };
    })
  );

  return NextResponse.json({ ok: true, requests: payload });
}
