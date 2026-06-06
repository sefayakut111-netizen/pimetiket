/**
 * POST /api/design/upload-init
 *
 * Client'a signed upload URL döner. Müşteri bu URL'e PUT ile dosyayı
 * yükler (Supabase Storage'a direkt). Sonra /upload-complete'i çağırır.
 *
 * Body: { orderId, originalName, sizeBytes, mimeType, orderItemId? }
 *
 * Validation:
 *   - Auth check
 *   - orderId müşteriye ait mi?
 *   - mime allowed?
 *   - size <= 30 MB?
 *   - Order status: ödeme alındı + dosya kabul edebilir mi?
 *     (paid, qc_pending, qc_flagged, operator_review)
 *     proof_pending'dan sonra revize sadece operatörle
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_MIME_TYPES,
  CUSTOMER_UPLOADABLE_ORDER_STATUSES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
  getExtensionFromMime,
} from "@/lib/storage/design-files";
import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";
import type { Json, TablesInsert } from "@/lib/supabase/types";

const InitBodySchema = z.object({
  orderId: z.string().min(1),
  originalName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  orderItemId: z.string().uuid().optional(),
  /** Mevcut design_files kaydını superseded yap (replace akışı) */
  replaceFileId: z.string().uuid().optional(),
  /**
   * Sefa 22 May v68 Faz 3b — Dosya kategorisi:
   *  - "design" (default): normal tasarım dosyası (renk + bıçak)
   *  - "white": beyaz plan dosyası (şeffaf sticker alt katmanı,
   *    ileri kullanıcı manuel upload). Storage path "_white/"
   *    subfolder'a gider, design_files.ai_check.kind="white" meta.
   */
  kind: z.enum(["design", "white"]).optional(),
});

const ACCEPTED_ORDER_STATUSES = CUSTOMER_UPLOADABLE_ORDER_STATUSES;

export async function POST(req: NextRequest) {
  // 1) Auth check
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2) Body validate
  let body: z.infer<typeof InitBodySchema>;
  try {
    body = InitBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_body",
        detail: err instanceof Error ? err.message : "validation_failed",
      },
      { status: 400 }
    );
  }

  const category = categorizeFile(body.originalName, body.mimeType);
  if (category === "blocked") {
    return NextResponse.json({ error: BLOCKED_FILE_MESSAGE }, { status: 400 });
  }

  // 3) Order var mı + müşteriye ait mi + status uygun mu?
  const admin = createAdminClient();
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", body.orderId)
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  const orderRow = order as unknown as {
    id: string;
    user_id: string;
    status: string;
  };
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    !ACCEPTED_ORDER_STATUSES.includes(
      orderRow.status as (typeof ACCEPTED_ORDER_STATUSES)[number]
    )
  ) {
    return NextResponse.json(
      { error: "order_status_not_uploadable", current: orderRow.status },
      { status: 400 }
    );
  }

  if (body.replaceFileId && body.orderItemId) {
    const { data: replaceTarget } = await admin
      .from("design_files")
      .select("id")
      .eq("id", body.replaceFileId)
      .eq("order_id", body.orderId)
      .eq("order_item_id", body.orderItemId)
      .maybeSingle();
    if (replaceTarget) {
      await admin
        .from("design_files")
        .update({ status: "superseded" })
        .eq("id", body.replaceFileId);
      console.log(
        "[design/upload-init] superseded replace target:",
        body.replaceFileId
      );
    }
  }

  // 4) Versiyon hesapla — bu order_item için kaçıncı upload?
  let version = 1;
  if (body.orderItemId) {
    const { data: existing } = await admin
      .from("design_files")
      .select("version")
      .eq("order_id", body.orderId)
      .eq("order_item_id", body.orderItemId)
      .order("version", { ascending: false })
      .limit(1);
    const top = (
      (existing as unknown as Array<{ version: number }>) ?? []
    )[0];
    version = (top?.version ?? 0) + 1;
  }

  // 5) Storage path — Faz 3b: kind=white → _white/ subfolder
  const fileId = crypto.randomUUID();
  const ext = getExtensionFromMime(body.mimeType);
  const kind = body.kind ?? "design";
  const subfolder = kind === "white" ? "_white/" : "";
  const storagePath = `${body.orderId}/${subfolder}${fileId}.${ext}`;

  // 6) Signed upload URL (Supabase Storage)
  // service_role ile Bucket policy bypass — guard zaten yukarıda yapıldı.
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signErr || !signed) {
    console.error("[design/upload-init] sign error:", signErr);
    return NextResponse.json(
      { error: "signed_url_failed", detail: signErr?.message },
      { status: 500 }
    );
  }

  // 7) design_files placeholder (status=uploaded olacak ama upload-complete'te
  // file size + sha256 ile finalize edilir)
  // Faz 3b: kind=white için ai_check.kind meta'sını set et — UI/üretici
  // bu dosyayı normal tasarımdan ayırır.
  const { error: insertErr } = await admin.from("design_files").insert([
    {
      id: fileId,
      order_id: body.orderId,
      user_id: user.id,
      order_item_id: body.orderItemId ?? null,
      storage_path: storagePath,
      original_name: body.originalName,
      size_bytes: body.sizeBytes,
      mime_type: body.mimeType,
      version,
      status: "uploaded",
      ai_check:
        kind === "white" ? ({ kind: "white", flags: [] } as Json) : null,
    } satisfies TablesInsert<"design_files">,
  ]);

  if (insertErr) {
    console.error("[design/upload-init] design_files insert:", insertErr);
    // signed URL döndük ama DB row açılmadı — temizlemeye çalış
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: "db_insert_failed", detail: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    uploadUrl: signed.signedUrl,
    token: signed.token,
    storagePath,
    fileId,
    version,
  });
}
