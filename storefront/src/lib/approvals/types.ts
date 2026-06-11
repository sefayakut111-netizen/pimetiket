/** Onay görseli API — paylaşılan tipler (OG-1 + UI). */

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type ApprovalRequestSource = "admin" | "partner";

export interface ApprovalAssetPayload {
  id: string;
  mime: string;
  sort: number;
  url: string | null;
}

export interface ApprovalRequestPayload {
  id: string;
  order_item_id: string | null;
  source: ApprovalRequestSource | string;
  partner_id: string | null;
  title: string;
  message: string | null;
  blocking: boolean;
  status: ApprovalRequestStatus | string;
  customer_comment: string | null;
  decided_at: string | null;
  created_at: string;
  assets: ApprovalAssetPayload[];
}
