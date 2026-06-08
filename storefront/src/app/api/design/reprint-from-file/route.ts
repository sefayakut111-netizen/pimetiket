/**
 * POST /api/design/reprint-from-file
 *
 * Tasarımlarım'dan "Yeniden bastır" — mevcut design_files kaydını
 * temp staging'e kopyalar, gerçek tempId döner.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STORAGE_BUCKET,
  getExtensionFromMime,
  ALLOWED_MIME_TYPES,
} from "@/lib/storage/design-files";
import { maybeSanitizeUploadBytes } from "@/lib/upload/sanitize-svg";

const BodySchema = z.object({
  designFileId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: df, error: dfErr } = await admin
    .from("design_files")
    .select(
      "id, order_id, storage_path, original_name, size_bytes, mime_type, status"
    )
    .eq("id", body.designFileId)
    .neq("status", "superseded")
    .maybeSingle();

  if (dfErr || !df) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = df as {
    id: string;
    order_id: string;
    storage_path: string;
    original_name: string;
    size_bytes: number;
    mime_type: string;
  };

  if (!ALLOWED_MIME_TYPES.includes(row.mime_type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json({ error: "unsupported_mime" }, { status: 400 });
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", row.order_id)
    .maybeSingle();

  if (orderErr || !order || (order as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fileId = crypto.randomUUID();
  const ext = getExtensionFromMime(row.mime_type);
  const destPath = `temp/${user.id}/${fileId}.${ext}`;

  const { data: blob, error: dlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(row.storage_path);

  if (dlErr || !blob) {
    console.error("[design/reprint-from-file] download:", dlErr);
    return NextResponse.json({ error: "source_missing" }, { status: 404 });
  }

  let uploadBody: Blob | Buffer = blob;
  try {
    uploadBody = maybeSanitizeUploadBytes(
      await blob.arrayBuffer(),
      row.mime_type,
      row.original_name
    );
  } catch (svgErr) {
    console.error("[design/reprint-from-file] svg sanitize:", svgErr);
    return NextResponse.json({ error: "svg_sanitize_failed" }, { status: 400 });
  }

  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(destPath, uploadBody, {
      contentType: row.mime_type,
      upsert: false,
    });

  if (upErr) {
    console.error("[design/reprint-from-file] upload:", upErr);
    return NextResponse.json({ error: "copy_failed" }, { status: 500 });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("design_temp_uploads")
    .insert([
      {
        id: fileId,
        user_id: user.id,
        storage_path: destPath,
        original_name: row.original_name,
        size_bytes: row.size_bytes,
        mime_type: row.mime_type,
        sha256: null,
      },
    ])
    .select("id")
    .single();

  if (insertErr || !inserted) {
    await admin.storage.from(STORAGE_BUCKET).remove([destPath]);
    console.error("[design/reprint-from-file] insert:", insertErr);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  const { data: previewSigned } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(destPath, 3600);

  return NextResponse.json({
    tempId: (inserted as { id: string }).id,
    previewUrl: previewSigned?.signedUrl ?? null,
    fileName: row.original_name,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
  });
}
