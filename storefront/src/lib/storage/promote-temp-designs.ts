/**
 * Promote temp design uploads → kalıcı design_files row.
 *
 * Sipariş açıldıktan sonra (callback'te) çağrılır:
 *   - cart_items'da design_temp_id olan satırlar için
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

/**
 * Bir sipariş için tüm temp design upload'larını promote et.
 * cart_items.design_temp_id field'ı zaten order_items.meta.designTempId
 * olarak kopyalanmış olmalı (callback'te gerçekleşir).
 *
 * @returns promoted count
 */
export async function promoteOrderDesigns(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  /** order_items array — meta.designTempId varsa promote edilir */
  orderItems: OrderItemWithDesign[];
}): Promise<number> {
  const { admin, orderId, userId, orderItems } = args;

  let promoted = 0;

  for (const orderItem of orderItems) {
    const designTempId = (orderItem.meta as { designTempId?: string })
      ?.designTempId;
    if (!designTempId || designTempId.startsWith("local-")) continue;

    console.log("[promote] processing designTempId:", designTempId, "item:", orderItem.id);

    // 1) Temp upload row'unu çek
    const { data: tempData, error: tempErr } = await admin
      .from("design_temp_uploads")
      .select(
        "id, storage_path, original_name, size_bytes, mime_type, sha256"
      )
      .eq("id", designTempId)
      .eq("user_id", userId)
      .is("promoted_to", null)
      .single();

    if (tempErr || !tempData) {
      console.warn(
        `[promote] temp upload not found for design_temp_id=${designTempId}:`,
        tempErr?.message
      );
      continue;
    }

    const temp = tempData as unknown as TempUploadRow;

    // 2) Storage'da dosyayı yeni path'e MOVE et
    // Path: temp/<userId>/<uuid>.<ext> → <orderId>/<uuid>.<ext>
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
      // Move başarısız oldu, kopyalamayı dene
      const { error: copyErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .copy(temp.storage_path, newPath);
      if (copyErr) {
        console.error("[promote] storage copy fallback failed:", copyErr);
        continue;
      }
    }

    // 3) design_files row aç (status=uploaded → analyzing async)
    const fileId = crypto.randomUUID();
    const { error: insertErr } = await admin.from("design_files").insert([
      {
        id: fileId,
        order_id: orderId,
        user_id: userId,
        order_item_id: orderItem.id,
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
      continue;
    }

    // 4) Temp upload row'unu işaretle (promoted_to)
    await admin
      .from("design_temp_uploads")
      .update({ promoted_to: fileId } satisfies TablesUpdate<"design_temp_uploads">)
      .eq("id", temp.id);

    // 5) order_events log
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
          orderItemId: orderItem.id,
          sizeBytes: temp.size_bytes,
          mimeType: temp.mime_type,
          source: "pre_purchase_upload",
        },
      } satisfies TablesInsert<"order_events">,
    ]);

    promoted++;
  }

  return promoted;
}
