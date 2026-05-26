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
 * Kurtarma: temp/ silinmiş ama dosya zaten {orderId}/ altındaysa design_files
 * satırı oluşturulur (yarım kalmış promote).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import { collectDesignTempIds, type AdditionalDesignMeta } from "@/lib/order-item-meta";
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
  promoted_to?: string | null;
}

function metaForTempId(
  meta: Record<string, unknown>,
  designTempId: string
): Pick<TempUploadRow, "original_name" | "size_bytes" | "mime_type"> | null {
  if (meta.designTempId === designTempId) {
    return {
      original_name:
        typeof meta.designFileName === "string"
          ? meta.designFileName
          : "design.png",
      size_bytes: 0,
      mime_type:
        typeof meta.designMimeType === "string"
          ? meta.designMimeType
          : "image/png",
    };
  }
  const additional = meta.additionalDesigns;
  if (Array.isArray(additional)) {
    for (const entry of additional) {
      if (
        entry &&
        typeof entry === "object" &&
        (entry as AdditionalDesignMeta).tempId === designTempId
      ) {
        const ad = entry as AdditionalDesignMeta;
        return {
          original_name: ad.fileName,
          size_bytes: ad.sizeBytes ?? 0,
          mime_type: ad.mimeType ?? "image/png",
        };
      }
    }
  }
  return null;
}

async function storageObjectExists(
  admin: SupabaseClient<Database>,
  path: string
): Promise<boolean> {
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(path);
  return !error && !!data;
}

async function ensureFileAtOrderPath(args: {
  admin: SupabaseClient<Database>;
  tempPath: string;
  orderPath: string;
}): Promise<boolean> {
  if (await storageObjectExists(args.admin, args.orderPath)) {
    return true;
  }
  const { error: moveErr } = await args.admin.storage
    .from(STORAGE_BUCKET)
    .move(args.tempPath, args.orderPath);
  if (!moveErr) return true;

  const { error: copyErr } = await args.admin.storage
    .from(STORAGE_BUCKET)
    .copy(args.tempPath, args.orderPath);
  return !copyErr;
}

async function promoteOneTemp(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  orderItemId: string;
  designTempId: string;
  itemMeta: Record<string, unknown>;
  /** Multi-design slot — unique index (order_id, order_item_id, version) */
  version: number;
}): Promise<boolean> {
  const {
    admin,
    orderId,
    userId,
    orderItemId,
    designTempId,
    itemMeta,
    version,
  } = args;

  console.log(
    "[promote] processing designTempId:",
    designTempId,
    "item:",
    orderItemId
  );

  const orderPath = `${orderId}/${designTempId}.png`;

  const { data: existingByPath } = await admin
    .from("design_files")
    .select("id")
    .eq("order_id", orderId)
    .eq("storage_path", orderPath)
    .neq("status", "superseded")
    .maybeSingle();

  if (existingByPath) {
    await admin
      .from("design_temp_uploads")
      .update({
        promoted_to: (existingByPath as { id: string }).id,
      } satisfies TablesUpdate<"design_temp_uploads">)
      .eq("id", designTempId)
      .is("promoted_to", null);
    return false;
  }

  const { data: tempData } = await admin
    .from("design_temp_uploads")
    .select(
      "id, storage_path, original_name, size_bytes, mime_type, sha256, promoted_to"
    )
    .eq("id", designTempId)
    .eq("user_id", userId)
    .maybeSingle();

  const temp = tempData as unknown as TempUploadRow | null;
  if (temp?.promoted_to) {
    return false;
  }

  const metaFallback = metaForTempId(itemMeta, designTempId);
  const originalName =
    temp?.original_name ?? metaFallback?.original_name ?? `${designTempId}.png`;
  const sizeBytes = temp?.size_bytes ?? metaFallback?.size_bytes ?? 0;
  const mimeType = temp?.mime_type ?? metaFallback?.mime_type ?? "image/png";
  const sha256 = temp?.sha256 ?? null;

  const tempPath =
    temp?.storage_path ?? `temp/${userId}/${designTempId}.png`;
  const fileName = tempPath.split("/").pop() ?? `${designTempId}.png`;
  const newPath = `${orderId}/${fileName}`;

  const ready = await ensureFileAtOrderPath({
    admin,
    tempPath,
    orderPath: newPath,
  });

  if (!ready && !(await storageObjectExists(admin, orderPath))) {
    console.warn(
      `[promote] storage missing for temp=${designTempId} paths=${tempPath}|${newPath}|${orderPath}`
    );
    return false;
  }

  const storagePath = (await storageObjectExists(admin, newPath))
    ? newPath
    : orderPath;

  const fileId = crypto.randomUUID();
  const { error: insertErr } = await admin.from("design_files").insert([
    {
      id: fileId,
      order_id: orderId,
      user_id: userId,
      order_item_id: orderItemId,
      storage_path: storagePath,
      original_name: originalName,
      size_bytes: sizeBytes,
      mime_type: mimeType,
      sha256,
      version,
      status: "analyzing",
    } satisfies TablesInsert<"design_files">,
  ]);

  if (insertErr) {
    console.error("[promote] design_files insert error:", insertErr);
    return false;
  }

  if (temp?.id) {
    await admin
      .from("design_temp_uploads")
      .update({ promoted_to: fileId } satisfies TablesUpdate<"design_temp_uploads">)
      .eq("id", temp.id);
  } else {
    await admin
      .from("design_temp_uploads")
      .update({ promoted_to: fileId } satisfies TablesUpdate<"design_temp_uploads">)
      .eq("id", designTempId)
      .is("promoted_to", null);
  }

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "file_uploaded",
      status_after: null,
      actor_id: userId,
      actor_role: "customer",
      summary: `Tasarım dosyası bağlandı: ${originalName}`,
      detail: {
        fileId,
        orderItemId,
        sizeBytes,
        mimeType,
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
    for (let slot = 0; slot < tempIds.length; slot++) {
      const designTempId = tempIds[slot];
      const ok = await promoteOneTemp({
        admin,
        orderId,
        userId,
        orderItemId: orderItem.id,
        designTempId,
        itemMeta: orderItem.meta,
        version: slot + 1,
      });
      if (ok) promoted++;
    }
  }

  return promoted;
}
