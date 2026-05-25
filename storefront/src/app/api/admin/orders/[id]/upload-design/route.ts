/**
 * POST /api/admin/orders/[id]/upload-design
 *
 * Manuel siparişler (user_id null) dahil admin tasarım yükleme.
 * FormData: file (File), orderItemId (uuid, opsiyonel)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
  getExtensionFromMime,
  type AllowedMime,
} from "@/lib/storage/design-files";
import {
  categorizeFile,
  BLOCKED_FILE_MESSAGE,
} from "@/lib/design-file-types";
import type { Json, TablesInsert } from "@/lib/supabase/types";

const ACCEPTED_ORDER_STATUSES = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "operator_review",
] as const;

function resolveMime(file: File): string {
  if (file.type && (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "ai":
      return "application/illustrator";
    case "psd":
      return "image/vnd.adobe.photoshop";
    case "svg":
      return "image/svg+xml";
    default:
      return file.type || "application/octet-stream";
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("orders", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData okunamadı" }, { status: 400 });
  }

  const file = formData.get("file");
  const orderItemIdRaw = formData.get("orderItemId");
  const orderItemId =
    typeof orderItemIdRaw === "string" && orderItemIdRaw.length > 0
      ? orderItemIdRaw
      : null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }

  const mimeType = resolveMime(file);
  if (categorizeFile(file.name, mimeType) === "blocked") {
    return NextResponse.json({ error: BLOCKED_FILE_MESSAGE }, { status: 400 });
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return NextResponse.json(
      { error: "Format desteklenmiyor. PNG, AI, PSD, PDF, SVG, JPG kabul edilir." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const currentStatus = (order as { status: string }).status;
  if (
    !ACCEPTED_ORDER_STATUSES.includes(
      currentStatus as (typeof ACCEPTED_ORDER_STATUSES)[number]
    )
  ) {
    return NextResponse.json(
      {
        error: `${currentStatus} durumundaki siparişe tasarım yüklenemez.`,
      },
      { status: 409 }
    );
  }

  if (orderItemId) {
    const { data: itemRow } = await admin
      .from("order_items")
      .select("id")
      .eq("id", orderItemId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (!itemRow) {
      return NextResponse.json({ error: "order_item_not_found" }, { status: 404 });
    }
  }

  const fileBytes = await file.arrayBuffer();
  const headerBytes = new Uint8Array(fileBytes).slice(0, 64);
  const magic = detectMimeFromMagicBytes(
    headerBytes,
    mimeType as AllowedMime
  );
  if (!magic.matchesClaim) {
    return NextResponse.json(
      {
        error: "file_content_mismatch",
        detail: `Dosya içeriği MIME ile uyumsuz (iddia: ${mimeType}, gerçek: ${magic.label}).`,
      },
      { status: 400 }
    );
  }

  let version = 1;
  if (orderItemId) {
    const { data: existing } = await admin
      .from("design_files")
      .select("version")
      .eq("order_id", orderId)
      .eq("order_item_id", orderItemId)
      .order("version", { ascending: false })
      .limit(1);
    const top = (
      (existing as unknown as Array<{ version: number }>) ?? []
    )[0];
    version = (top?.version ?? 0) + 1;
  }

  const fileId = crypto.randomUUID();
  const ext = getExtensionFromMime(mimeType);
  const storagePath = `${orderId}/${fileId}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    });
  if (uploadErr) {
    console.error("[admin/upload-design] storage error:", uploadErr);
    return NextResponse.json(
      { error: "Yükleme başarısız: " + uploadErr.message },
      { status: 500 }
    );
  }

  const { error: insertErr } = await admin.from("design_files").insert([
    {
      id: fileId,
      order_id: orderId,
      user_id: auth.user.id,
      order_item_id: orderItemId,
      storage_path: storagePath,
      original_name: file.name,
      size_bytes: file.size,
      mime_type: mimeType,
      version,
      status: "analyzing",
    } satisfies TablesInsert<"design_files">,
  ]);

  if (insertErr) {
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: "db_insert_failed", detail: insertErr.message },
      { status: 500 }
    );
  }

  if (currentStatus === "paid" || currentStatus === "awaiting_upload") {
    await admin
      .from("orders")
      .update({ status: "qc_pending" })
      .eq("id", orderId);
  }

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "file_uploaded",
      status_after: "qc_pending",
      actor_id: auth.user.id,
      actor_role: auth.role,
      summary: `Admin tasarım dosyası yükledi: ${file.name}`,
      detail: {
        fileId,
        orderItemId,
        sizeBytes: file.size,
        mimeType,
      } as Json,
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({
    ok: true,
    fileId,
    storagePath,
    status: "analyzing",
  });
}
