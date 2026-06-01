import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadFromR2 } from "@/lib/storage/r2-client";
import { saveCutlineEdit } from "@/lib/proof/save-cutline-edit";
import type { Database, Json } from "@/lib/supabase/types";

interface OrderItemRow {
  id: string;
  meta: Record<string, unknown> | null;
}

async function promoteDraftForItem(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  item: OrderItemRow;
  draftId: string;
}): Promise<boolean> {
  const { admin, orderId, userId, item, draftId } = args;

  const { data: draftRow } = await admin
    .from("editor_cutline_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("user_id", userId)
    .is("promoted_to", null)
    .maybeSingle();

  if (!draftRow) return false;

  const draft = draftRow as {
    id: string;
    svg_key: string;
    source: string;
    mode: string;
    offset_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    cutline_width_mm: number | null;
    cutline_height_mm: number | null;
    placement_json: { x: number; y: number; scale: number } | null;
    material_type: string | null;
  };

  let svg: string;
  try {
    svg = (await downloadFromR2(draft.svg_key)).toString("utf-8");
  } catch (err) {
    console.error("[promote-editor-cutline] svg download:", draftId, err);
    return false;
  }

  const { data: dfRow } = await admin
    .from("design_files")
    .select("id")
    .eq("order_id", orderId)
    .eq("order_item_id", item.id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const designFileId = (dfRow as { id: string } | null)?.id ?? null;
  if (!designFileId) {
    const meta = item.meta ?? {};
    await admin
      .from("order_items")
      .update({
        meta: {
          ...meta,
          pending_editor_cutline_draft_id: draftId,
        },
      })
      .eq("id", item.id);
    console.warn(
      "[promote-editor-cutline] deferred cutline — no design_file yet for item",
      item.id
    );
    return false;
  }

  const result = await saveCutlineEdit(admin, {
    orderId,
    itemId: item.id,
    actorUserId: userId,
    actorRole: "customer",
    editorPromote: true,
    body: {
      svg,
      source: draft.source,
      mode: draft.mode,
      offset_mm: draft.offset_mm,
      width_mm: draft.width_mm,
      height_mm: draft.height_mm,
      cutline_width_mm: draft.cutline_width_mm,
      cutline_height_mm: draft.cutline_height_mm,
      image_placement: draft.placement_json,
      material_type: draft.material_type,
      cutline_source: "geo_shape",
      detection_method: "editor_preorder",
      design_file_id: designFileId,
      auto: false,
    },
  });

  if (!result.ok) {
    console.error("[promote-editor-cutline] save failed:", result.error);
    return false;
  }

  await admin
    .from("editor_cutline_drafts")
    .update({ promoted_to: result.cutlineId })
    .eq("id", draft.id);

  const meta = item.meta ?? {};
  if (meta.pending_editor_cutline_draft_id === draftId) {
    const { pending_editor_cutline_draft_id: _removed, ...rest } = meta as {
      pending_editor_cutline_draft_id?: string;
      [key: string]: unknown;
    };
    await admin.from("order_items").update({ meta: rest as Json }).eq("id", item.id);
  }

  return true;
}

/**
 * design_files oluştuktan sonra bekleyen editör cutline draft'ını dene.
 */
export async function retryPendingEditorCutlineForItem(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  orderItemId: string;
  itemMeta: Record<string, unknown>;
}): Promise<boolean> {
  const draftId =
    typeof args.itemMeta.editor_cutline_draft_id === "string"
      ? args.itemMeta.editor_cutline_draft_id
      : typeof args.itemMeta.pending_editor_cutline_draft_id === "string"
        ? args.itemMeta.pending_editor_cutline_draft_id
        : null;
  if (!draftId) return false;
  return promoteDraftForItem({
    admin: args.admin,
    orderId: args.orderId,
    userId: args.userId,
    item: { id: args.orderItemId, meta: args.itemMeta },
    draftId,
  });
}

/**
 * Editörde hazırlanan cutline draft'larını ödeme sonrası order_item'a bağla.
 */
export async function promoteEditorCutlines(args: {
  admin: SupabaseClient<Database>;
  orderId: string;
  userId: string;
  orderItems: OrderItemRow[];
}): Promise<number> {
  const { admin, orderId, userId, orderItems } = args;
  let promoted = 0;

  for (const item of orderItems) {
    const meta = item.meta ?? {};
    const draftId = meta.editor_cutline_draft_id;
    if (typeof draftId !== "string" || !draftId) continue;

    const ok = await promoteDraftForItem({
      admin,
      orderId,
      userId,
      item,
      draftId,
    });
    if (ok) promoted++;
  }

  return promoted;
}
