import type { SupabaseClient } from "@supabase/supabase-js";
import { createApprovalAssetSignedUrl } from "@/lib/approvals/approval-storage";
import type { ApprovalRequestPayload } from "@/lib/approvals/types";

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

export async function listApprovalRequestsForOrder(
  admin: SupabaseClient,
  orderId: string,
  options?: { partnerId?: string }
): Promise<ApprovalRequestPayload[]> {
  let query = admin
    .from("approval_requests")
    .select(
      "id, order_id, order_item_id, source, partner_id, title, message, blocking, status, customer_comment, decided_at, created_at"
    )
    .eq("order_id", orderId);

  if (options?.partnerId) {
    query = query.eq("partner_id", options.partnerId);
  }

  const { data: requests, error: reqErr } = await query.order("created_at", {
    ascending: false,
  });

  if (reqErr) {
    throw new Error(reqErr.message);
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
      throw new Error(assetErr.message);
    }
    assets = (assetRows ?? []) as AssetRow[];
  }

  const assetsByRequest = new Map<string, AssetRow[]>();
  for (const a of assets) {
    const list = assetsByRequest.get(a.request_id) ?? [];
    list.push(a);
    assetsByRequest.set(a.request_id, list);
  }

  return await Promise.all(
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
        partner_id: r.partner_id,
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
}
