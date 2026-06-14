/**
 * POST /api/design/enhance/accept — iyileştirilmiş görseli design_files'a uygula (proof akışı)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runProofValidationAfterEdit } from "@/lib/proof/orchestrator";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { deleteFromR2 } from "@/lib/storage/r2-client";
import { isR2StorageKey } from "@/lib/storage/purge-r2";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export const runtime = "nodejs";

const Body = z.object({
  orderId: z.string().min(1),
  itemId: z.string().uuid(),
  designFileId: z.string().uuid(),
  enhancedTempDesignId: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", body.orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow || orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: item } = await admin
    .from("order_items")
    .select("width, height, meta")
    .eq("id", body.itemId)
    .eq("order_id", body.orderId)
    .maybeSingle();
  const itemRow = item as {
    width: number;
    height: number;
    meta: Record<string, unknown> | null;
  } | null;
  if (!itemRow) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 });
  }

  const { data: originalDf } = await admin
    .from("design_files")
    .select("id, storage_path, original_name, version, mime_type")
    .eq("id", body.designFileId)
    .eq("order_id", body.orderId)
    .neq("status", "superseded")
    .maybeSingle();
  const designFile = originalDf as {
    id: string;
    storage_path: string;
    original_name: string;
    version: number;
    mime_type: string;
  } | null;
  if (!designFile) {
    return NextResponse.json({ error: "design_not_found" }, { status: 404 });
  }

  const { data: enhancedTemp } = await admin
    .from("design_temp_uploads")
    .select("id, storage_path, original_name, size_bytes, mime_type, user_id")
    .eq("id", body.enhancedTempDesignId)
    .maybeSingle();
  const enhancedRow = enhancedTemp as {
    id: string;
    storage_path: string;
    original_name: string;
    size_bytes: number;
    mime_type: string;
    user_id: string;
  } | null;
  if (!enhancedRow || enhancedRow.user_id !== user.id) {
    return NextResponse.json({ error: "enhanced_not_found" }, { status: 404 });
  }

  const { data: enhancedBlob, error: dlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(enhancedRow.storage_path);
  if (dlErr || !enhancedBlob) {
    return NextResponse.json({ error: "enhanced_download_failed" }, { status: 500 });
  }
  const buffer = Buffer.from(await enhancedBlob.arrayBuffer());

  const newFileId = crypto.randomUUID();
  const storagePath = `${body.orderId}/${newFileId}.png`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
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

  // B3 — süpersede edilen eski objeyi fiziksel sil (KVKK orphan; purge 'superseded' taramıyor).
  // Yeni dosya zaten yüklü (109-117) → güvenli. Best-effort, R2-branch zorunlu (büyük dosya R2'de).
  try {
    if (isR2StorageKey(designFile.storage_path)) {
      await deleteFromR2(designFile.storage_path);
    } else {
      await admin.storage.from(STORAGE_BUCKET).remove([designFile.storage_path]);
    }
  } catch (e) {
    console.warn("[enhance-accept] eski obje silinemedi:", designFile.storage_path, e);
  }

  const baseName = designFile.original_name.replace(/\.[^.]+$/, "");
  const newRow: TablesInsert<"design_files"> = {
    id: newFileId,
    order_id: body.orderId,
    order_item_id: body.itemId,
    user_id: user.id,
    storage_path: storagePath,
    original_name: `${baseName}-enhanced.png`,
    mime_type: "image/png",
    size_bytes: buffer.length,
    version: designFile.version + 1,
    status: "uploaded",
  };
  await admin.from("design_files").insert(newRow);

  const meta = itemRow.meta ?? {};
  await admin
    .from("order_items")
    .update({
      meta: {
        ...meta,
        enhance_dismissed: true,
        enhance_accepted_at: new Date().toISOString(),
      } as Json,
    })
    .eq("id", body.itemId);

  const { data: newSigned } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 300);

  const materialKey = String(meta.material_type ?? meta.material ?? "paper");
  if (newSigned?.signedUrl && orderRow.status === "proof_pending") {
    void runProofValidationAfterEdit({
      orderId: body.orderId,
      itemId: body.itemId,
      designFileId: newFileId,
      svg: "",
      fileName: newRow.original_name ?? `${baseName}-enhanced.png`,
      designFileUrl: newSigned.signedUrl,
      materialKey,
      designWidth: itemRow.width,
      designHeight: itemRow.height,
    });
  }

  const { data: previewSigned } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({
    ok: true,
    designFileId: newFileId,
    previewUrl: previewSigned?.signedUrl ?? null,
  });
}
