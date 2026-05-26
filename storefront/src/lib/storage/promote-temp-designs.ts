/**
 * Promote temp design uploads → kalıcı design_files row.
 *
 * Sipariş açıldıktan sonra (callback'te) çağrılır:
 *   - meta.designTempId + meta.additionalDesigns[].tempId
 *     design_temp_uploads → storage rename → design_files row
 *
 * Storage path:
 *   FROM: temp/<userId>/<uuid>.<ext>
 *   TO:   <orderId>/<uuid>.<ext>
 *
 * Sonra AI ön-kontrol pipeline'ı tetiklenir (status=analyzing).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import { collectDesignTempIds } from "@/lib/order-item-meta";
import { STORAGE_BUCKET } from "./design-files";

interface OrderItemWithDesign {
  id: string;
  product: "sticker" | "etiket";
  meta: Record<string, unknown>;
}

interface TempUploadRow {
  id: string;
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  sha256: string | null;
}

async function promoteOneTemp(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  orderItemId: string;
  designTempId: string;
}): Promise<boolean> {
  const { admin, orderId, userId, orderItemId, designTempId } = args;

  console.log(
    "[promote] processing designTempId:",
    designTempId,
    "item:",
    orderItemId
  );

  const { data: tempData, error: tempErr } = await admin
    .from("design_temp_uploads")
    .select("id, storage_path, original_name, size_bytes, mime_type, sha256")
    .eq("id", designTempId)
    .eq("user_id", userId)
    .is("promoted_to", null)
    .single();

  if (tempErr || !tempData) {
    console.warn(
      `[promote] temp upload not found for design_temp_id=${designTempId}:`,
      tempErr?.message
    );
    return false;
  }

  const temp = tempData as unknown as TempUploadRow;
  const fileName = temp.storage_path.split("/").pop() ?? "design.bin";
  const newPath = `${orderId}/${fileName}`;

  const { error: moveErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .move(temp.storage_path, newPath);

  if (moveErr) {
    console.error(
      `[promote] storage move failed (${temp.storage_path} → ${newPath}):`,
      moveErr.message
    );
    const { error: copyErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .copy(temp.storage_path, newPath);
    if (copyErr) {
      console.error("[promote] storage copy fallback failed:", copyErr);
      return false;
    }
  }

  const fileId = crypto.randomUUID();
  const { error: insertErr } = await admin.from("design_files").insert([
    {
      id: fileId,
      order_id: orderId,
      user_id: userId,
      order_item_id: orderItemId,
      storage_path: newPath,
      original_name: temp.original_name,
      size_bytes: temp.size_bytes,
      mime_type: temp.mime_type,
      sha256: temp.sha256,
      version: 1,
      status: "analyzing",
    } satisfies TablesInsert<"design_files">,
  ]);

  if (insertErr) {
    console.error("[promote] design_files insert error:", insertErr);
    return false;
  }

  await admin
    .from("design_temp_uploads")
    .update({ promoted_to: fileId } satisfies TablesUpdate<"design_temp_uploads">)
    .eq("id", temp.id);

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "file_uploaded",
      status_after: null,
      actor_id: userId,
      actor_role: "customer",
      summary: `Tasarım dosyası bağlandı: ${temp.original_name}`,
      detail: {
        fileId,
        orderItemId,
        sizeBytes: temp.size_bytes,
        mimeType: temp.mime_type,
        source: "pre_purchase_upload",
      },
    } satisfies TablesInsert<"order_events">,
  ]);

  return true;
}

/**
 * Bir sipariş için tüm temp design upload'larını promote et.
 *
 * @returns promoted count
 */
export async function promoteOrderDesigns(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  orderItems: OrderItemWithDesign[];
}): Promise<number> {
  const { admin, orderId, userId, orderItems } = args;

  let promoted = 0;

  for (const orderItem of orderItems) {
    const tempIds = collectDesignTempIds(orderItem.meta);
    for (const designTempId of tempIds) {
      const ok = await promoteOneTemp({
        admin,
        orderId,
        userId,
        orderItemId: orderItem.id,
        designTempId,
      });
      if (ok) promoted++;
    }
  }

  return promoted;
}
