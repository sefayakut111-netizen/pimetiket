/**
 * Onay görseli isteği oluşturma — admin + partner API paylaşımı.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, TablesInsert } from "@/lib/supabase/types";
import {
  detectApprovalMime,
  uploadApprovalAsset,
  validateApprovalFileCount,
  validateApprovalFileSize,
  type ApprovalMime,
} from "@/lib/approvals/approval-storage";

export type ApprovalSource = "admin" | "partner";

export interface ParsedApprovalFile {
  name: string;
  bytes: Uint8Array;
  mime: ApprovalMime;
}

export interface CreateApprovalRequestInput {
  orderId: string;
  orderItemId: string | null;
  source: ApprovalSource;
  partnerId: string | null;
  createdBy: string;
  title: string;
  message: string | null;
  blocking: boolean;
  actorRole: string;
  files: File[];
}

export type CreateApprovalRequestResult =
  | {
      ok: true;
      requestId: string;
      assetCount: number;
    }
  | { ok: false; status: number; error: string };

function resolveClaimedMime(file: File): string {
  if (
    file.type &&
    ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
      file.type
    )
  ) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return file.type || "application/octet-stream";
  }
}

export async function parseApprovalUploadFiles(
  files: File[]
): Promise<
  { ok: true; parsed: ParsedApprovalFile[] } | { ok: false; error: string }
> {
  const countErr = validateApprovalFileCount(files.length);
  if (countErr) return { ok: false, error: countErr };

  const parsed: ParsedApprovalFile[] = [];
  for (const file of files) {
    const sizeErr = validateApprovalFileSize(file.size);
    if (sizeErr) return { ok: false, error: sizeErr };

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const claimed = resolveClaimedMime(file);
    const detected = detectApprovalMime(bytes, claimed);
    if (!detected.mime) {
      return {
        ok: false,
        error:
          detected.error === "format_not_allowed"
            ? "Format desteklenmiyor. PNG, JPG, WEBP veya PDF yükleyin."
            : "Dosya içeriği formatla uyuşmuyor",
      };
    }
    parsed.push({ name: file.name, bytes, mime: detected.mime });
  }
  return { ok: true, parsed };
}

export async function createApprovalRequest(
  admin: SupabaseClient,
  input: CreateApprovalRequestInput,
  parsedFiles: ParsedApprovalFile[]
): Promise<CreateApprovalRequestResult> {
  const { orderId, orderItemId, source, partnerId, createdBy } = input;

  if (orderItemId) {
    const { data: itemRow } = await admin
      .from("order_items")
      .select("id")
      .eq("id", orderItemId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (!itemRow) {
      return { ok: false, status: 400, error: "order_item_not_found" };
    }
  }

  const { data: inserted, error: insertErr } = await admin
    .from("approval_requests")
    .insert({
      order_id: orderId,
      order_item_id: orderItemId,
      source,
      partner_id: partnerId,
      created_by: createdBy,
      title: input.title.trim(),
      message: input.message,
      blocking: input.blocking,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[approval-requests] insert failed:", insertErr);
    return { ok: false, status: 500, error: "request_create_failed" };
  }

  const requestId = (inserted as { id: string }).id;
  const assetRows: {
    request_id: string;
    storage_path: string;
    mime: string;
    sort: number;
  }[] = [];

  for (let i = 0; i < parsedFiles.length; i++) {
    const f = parsedFiles[i];
    const uploaded = await uploadApprovalAsset(
      admin,
      orderId,
      requestId,
      f.bytes,
      f.mime
    );
    if ("error" in uploaded) {
      await admin.from("approval_requests").delete().eq("id", requestId);
      return { ok: false, status: 500, error: "asset_upload_failed" };
    }
    assetRows.push({
      request_id: requestId,
      storage_path: uploaded.storagePath,
      mime: f.mime,
      sort: i,
    });
  }

  if (assetRows.length > 0) {
    const { error: assetsErr } = await admin.from("approval_assets").insert(
      assetRows
    );
    if (assetsErr) {
      console.error("[approval-requests] assets insert failed:", assetsErr);
      await admin.from("approval_requests").delete().eq("id", requestId);
      return { ok: false, status: 500, error: "asset_rows_failed" };
    }
  }

  const eventDetail: Json = {
    request_id: requestId,
    source,
    title: input.title.trim(),
    blocking: input.blocking,
    order_item_id: orderItemId,
    asset_count: assetRows.length,
    partner_id: partnerId,
  };

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "approval_requested",
      summary: `Onay görseli isteği: ${input.title.trim()}`,
      actor_id: createdBy,
      actor_role: input.actorRole,
      detail: eventDetail,
    } satisfies TablesInsert<"order_events">,
  ]);

  const { data: orderUserRow } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  const orderUserId = (orderUserRow as { user_id?: string } | null)?.user_id;
  if (orderUserId) {
    const { sendApprovalRequestToCustomer } = await import(
      "@/lib/mail/notifications"
    );
    void sendApprovalRequestToCustomer({
      userId: orderUserId,
      orderId,
      requestId,
      title: input.title.trim(),
      assetCount: assetRows.length,
    });
  }

  return { ok: true, requestId, assetCount: assetRows.length };
}
