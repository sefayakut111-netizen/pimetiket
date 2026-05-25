/**
 * POST /api/design/temp-upload-complete
 *
 * Browser Storage'a PUT ettikten sonra çağrılır. design_temp_uploads
 * tablosuna row açar, signed preview URL döner.
 *
 * Body: { fileId, storagePath, originalName, sizeBytes, mimeType, sha256? }
 *
 * Response:
 *   { tempId: <uuid>, previewUrl: <signed url, 1 saat> }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
} from "@/lib/storage/design-files";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";

const CompleteBodySchema = z.object({
  fileId: z.string().uuid(),
  storagePath: z.string().min(1),
  originalName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  sha256: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof CompleteBodySchema>;
  try {
    body = CompleteBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_body",
        detail: err instanceof Error ? err.message : "validation_failed",
      },
      { status: 400 }
    );
  }

  // Path doğrulaması — user kendi temp klasörüne yazıyor mu?
  const expectedPrefix = `temp/${user.id}/`;
  if (!body.storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "invalid_storage_path" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Magic-byte check (audit P0 12 May) — ilk 512 byte'ı in, iddia ile
  // gerçek MIME'i compare et. .exe / .zip / fake header gelmesin diye.
  try {
    const { data: head, error: dlErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(body.storagePath);
    if (dlErr || !head) {
      console.error("[design/temp-complete] head download error:", dlErr);
      await admin.storage.from(STORAGE_BUCKET).remove([body.storagePath]);
      return NextResponse.json(
        { error: "magic_byte_check_failed", detail: dlErr?.message },
        { status: 500 }
      );
    }
    // İlk 512 byte yeterli — Blob slice + arrayBuffer ile bandwidth tasarrufu
    const slice = await head.slice(0, 512).arrayBuffer();
    const buf = new Uint8Array(slice);
    const magic = detectMimeFromMagicBytes(buf, body.mimeType);
    if (!magic.matchesClaim) {
      // Quarantine: dosyayı sil, audit log yaz
      console.warn(
        `[design/temp-complete] MIME spoof: user=${user.id} ` +
          `claimed=${body.mimeType} detected=${magic.detected ?? "unknown"} ` +
          `label=${magic.label}`
      );
      await admin.storage.from(STORAGE_BUCKET).remove([body.storagePath]);
      // audit_log varsa yaz — yoksa silent
      await admin.from("audit_log").insert([
        {
          actor_id: user.id,
          actor_role: "customer",
          action: "design_file.reject" as Enums<"audit_action">,
          target_type: "design_file",
          target_id: body.storagePath,
          summary: "MIME spoof blocked on temp design upload",
          detail: {
            kind: "mime_spoof_blocked",
            claimedMime: body.mimeType,
            detectedMime: magic.detected,
            detectedLabel: magic.label,
            originalName: body.originalName,
            sizeBytes: body.sizeBytes,
            storagePath: body.storagePath,
          },
        },
      ]);
      return NextResponse.json(
        {
          error: "mime_mismatch",
          detail:
            "Dosya tipi belirtilenden farklı. Lütfen orijinal PDF/PNG/AI/JPG yükle.",
          claimed: body.mimeType,
          detected: magic.detected,
        },
        { status: 400 }
      );
    }
  } catch (e) {
    console.error("[design/temp-complete] magic-byte exception:", e);
    // Fail-CLOSED: hata olursa kabul etme
    await admin.storage.from(STORAGE_BUCKET).remove([body.storagePath]);
    return NextResponse.json(
      { error: "magic_byte_check_exception" },
      { status: 500 }
    );
  }

  // design_temp_uploads INSERT
  const { data: row, error: insertErr } = await admin
    .from("design_temp_uploads")
    .insert([
      {
        id: body.fileId,
        user_id: user.id,
        storage_path: body.storagePath,
        original_name: body.originalName,
        size_bytes: body.sizeBytes,
        mime_type: body.mimeType,
        sha256: body.sha256 ?? null,
      },
    ])
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[design/temp-complete] insert error:", insertErr);
    // Storage cleanup
    await admin.storage.from(STORAGE_BUCKET).remove([body.storagePath]);
    return NextResponse.json(
      { error: "db_insert_failed", detail: insertErr?.message },
      { status: 500 }
    );
  }

  // Preview için signed URL (1 saat geçerli)
  const { data: previewSigned, error: previewErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(body.storagePath, 3600);

  if (previewErr) {
    console.warn("[design/temp-complete] preview URL warn:", previewErr);
  }

  return NextResponse.json({
    tempId: (row as { id: string }).id,
    previewUrl: previewSigned?.signedUrl ?? null,
  });
}

// ============================================================
// DELETE — Replace senaryosunda eski temp upload'u sil
// ============================================================

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tempId = req.nextUrl.searchParams.get("id");
  if (!tempId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Row'u çek + ownership check
  const { data: row, error: fetchErr } = await admin
    .from("design_temp_uploads")
    .select("user_id, storage_path, promoted_to")
    .eq("id", tempId)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const r = row as unknown as {
    user_id: string;
    storage_path: string;
    promoted_to: string | null;
  };

  if (r.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (r.promoted_to) {
    return NextResponse.json(
      { error: "already_promoted_use_design_files_endpoint" },
      { status: 400 }
    );
  }

  // Storage'dan sil
  await admin.storage.from(STORAGE_BUCKET).remove([r.storage_path]);
  // DB row'unu sil
  await admin.from("design_temp_uploads").delete().eq("id", tempId);

  return NextResponse.json({ ok: true });
}
