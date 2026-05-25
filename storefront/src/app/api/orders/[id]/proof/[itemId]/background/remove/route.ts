/**
 * POST /api/orders/[id]/proof/[itemId]/background/remove
 * Arka planı kaldır → yeni PNG design_files kaydı.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeBackground } from "@/lib/proof/background-remove";
import { runProofValidationAfterEdit } from "@/lib/proof/orchestrator";
import { uploadProofArtifact } from "@/lib/proof/proof-artifacts";
import {
  STORAGE_BUCKET,
} from "@/lib/storage/design-files";
import type { BgDetectResult } from "@/lib/proof/background-detect";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    designFileId?: string | null;
  };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow || orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: item } = await admin
    .from("order_items")
    .select("width, height, meta")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  const itemRow = item as {
    width: number;
    height: number;
    meta: Record<string, unknown> | null;
  } | null;
  if (!itemRow) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 });
  }

  const meta = itemRow.meta ?? {};
  const bgDetect = meta.bg_detect as BgDetectResult | undefined;
  if (!bgDetect?.needsRemoval) {
    return NextResponse.json({ error: "no_bg_removal_needed" }, { status: 400 });
  }

  const dfQuery = admin
    .from("design_files")
    .select("id, storage_path, original_name, version, mime_type")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded");
  const { data: dfRow } = body.designFileId
    ? await dfQuery.eq("id", body.designFileId).maybeSingle()
    : await dfQuery.order("version", { ascending: false }).limit(1).maybeSingle();

  const designFile = dfRow as {
    id: string;
    storage_path: string;
    original_name: string;
    version: number;
    mime_type: string;
  } | null;
  if (!designFile) {
    return NextResponse.json({ error: "design_not_found" }, { status: 404 });
  }

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(designFile.storage_path, 300);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  const removed = await removeBackground(signed.signedUrl, bgDetect);
  if (!removed.success || !removed.outputBuffer) {
    return NextResponse.json(
      { error: removed.error ?? "remove_failed" },
      { status: 500 }
    );
  }

  const newFileId = crypto.randomUUID();
  const ext = "png";
  const storagePath = `${orderId}/${newFileId}.${ext}`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, removed.outputBuffer, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  await admin
    .from("design_files")
    .update({ status: "superseded" })
    .eq("id", designFile.id);

  const baseName = designFile.original_name.replace(/\.[^.]+$/, "");
  const newRow: TablesInsert<"design_files"> = {
    id: newFileId,
    order_id: orderId,
    order_item_id: itemId,
    user_id: user.id,
    storage_path: storagePath,
    original_name: `${baseName}-nobg.png`,
    mime_type: "image/png",
    size_bytes: removed.outputBuffer.length,
    version: designFile.version + 1,
    status: "uploaded",
  };
  await admin.from("design_files").insert(newRow);

  const { signedUrl: previewUrl } = await uploadProofArtifact(
    orderId,
    itemId,
    "bg-preview-after",
    removed.outputBuffer
  );

  const materialKey = String(meta.material_type ?? meta.material ?? "paper");
  await admin
    .from("order_items")
    .update({
      meta: {
        ...meta,
        bg_detect: null,
        bg_removal_dismissed: true,
        bg_removed_at: new Date().toISOString(),
      } as Json,
    })
    .eq("id", itemId);

  const { data: newSigned } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 300);

  if (newSigned?.signedUrl && orderRow.status === "proof_pending") {
    void runProofValidationAfterEdit({
      orderId,
      itemId,
      designFileId: newFileId,
      svg: "",
      fileName: newRow.original_name ?? `${baseName}-nobg.png`,
      designFileUrl: newSigned.signedUrl,
      materialKey,
      designWidth: itemRow.width,
      designHeight: itemRow.height,
    });
  }

  return NextResponse.json({
    ok: true,
    designFileId: newFileId,
    previewUrl,
    method: removed.method,
  });
}
