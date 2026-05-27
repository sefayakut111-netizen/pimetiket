/**
 * POST /api/design/upload-complete
 *
 * Client signed URL'e PUT ettikten sonra çağırır. Server:
 *   - design_files satırını günceller (sha256 + ai_check başlat)
 *   - AI ön-kontrol pipeline'ı tetikler (runOrderDesignQC)
 *   - order_events 'file_uploaded' log
 *
 * Body: { fileId, sha256? }
 *
 * Magic-byte check: storage/R2'dan ilk 512 byte indirilir, MIME iddiası doğrulanır.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import type { AllowedMime } from "@/lib/storage/design-files";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";
import { isR2StorageKey } from "@/lib/storage/purge-r2";
import { deleteFromR2, downloadFromR2 } from "@/lib/storage/r2-client";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";
import type {
  Enums,
  Json,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/types";

const CompleteBodySchema = z.object({
  fileId: z.string().uuid(),
  sha256: z.string().optional(),
});

interface DesignFileRow {
  id: string;
  order_id: string;
  user_id: string;
  order_item_id: string | null;
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  status: string;
}

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

  const admin = createAdminClient();

  // 1) design_files satırını çek
  const { data: file, error: fileErr } = await admin
    .from("design_files")
    .select("*")
    .eq("id", body.fileId)
    .single();

  if (fileErr || !file) {
    return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  }
  const fileRow = file as unknown as DesignFileRow;
  if (fileRow.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fileCategory = categorizeFile(
    fileRow.original_name,
    fileRow.mime_type
  );
  if (fileCategory === "blocked") {
    if (isR2StorageKey(fileRow.storage_path)) {
      await deleteFromR2(fileRow.storage_path);
    } else {
      await admin.storage.from(STORAGE_BUCKET).remove([fileRow.storage_path]);
    }
    await admin
      .from("design_files")
      .update({
        status: "rejected" as Enums<"design_file_status">,
        ai_check: {
          flags: [{ kind: "error", message: BLOCKED_FILE_MESSAGE }],
        } as Json,
      } satisfies TablesUpdate<"design_files">)
      .eq("id", body.fileId);
    return NextResponse.json({ error: BLOCKED_FILE_MESSAGE }, { status: 400 });
  }

  // Magic-byte doğrulama (sync — upload-complete hot path)
  try {
    let headerBytes: Uint8Array;
    if (isR2StorageKey(fileRow.storage_path)) {
      const buf = await downloadFromR2(fileRow.storage_path);
      headerBytes = buf.subarray(0, Math.min(512, buf.length));
    } else {
      const { data: blob, error: dlErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .download(fileRow.storage_path);
      if (dlErr || !blob) {
        return NextResponse.json(
          { error: "magic_byte_check_failed", detail: dlErr?.message },
          { status: 500 }
        );
      }
      headerBytes = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
    }

    const magic = detectMimeFromMagicBytes(
      headerBytes,
      fileRow.mime_type as AllowedMime
    );
    if (!magic.matchesClaim) {
      if (isR2StorageKey(fileRow.storage_path)) {
        await deleteFromR2(fileRow.storage_path);
      } else {
        await admin.storage
          .from(STORAGE_BUCKET)
          .remove([fileRow.storage_path]);
      }
      await admin
        .from("design_files")
        .update({
          status: "rejected" as Enums<"design_file_status">,
          ai_check: {
            flags: [
              {
                kind: "error",
                message: `Dosya içeriği MIME ile uyumsuz (iddia: ${fileRow.mime_type}, gerçek: ${magic.label}).`,
              },
            ],
          } as Json,
        } satisfies TablesUpdate<"design_files">)
        .eq("id", body.fileId);
      return NextResponse.json(
        {
          error: "mime_mismatch",
          claimed: fileRow.mime_type,
          detected: magic.detected,
        },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("[design/upload-complete] magic-byte error:", err);
    return NextResponse.json(
      { error: "magic_byte_check_failed" },
      { status: 500 }
    );
  }

  // 2) Status'u 'analyzing'e geçir + sha256 set et
  const { error: updateErr } = await admin
    .from("design_files")
    .update({
      status: "analyzing",
      sha256: body.sha256 ?? null,
    } satisfies TablesUpdate<"design_files">)
    .eq("id", body.fileId);

  if (updateErr) {
    console.error("[design/upload-complete] update error:", updateErr);
    return NextResponse.json(
      { error: "update_failed" },
      { status: 500 }
    );
  }

  // 3) order_events 'file_uploaded' log
  await admin.from("order_events").insert([
    {
      order_id: fileRow.order_id,
      event_type: "file_uploaded",
      status_after: null,
      actor_id: user.id,
      actor_role: "customer",
      summary: `Tasarım dosyası yüklendi: ${fileRow.original_name}`,
      detail: {
        fileId: body.fileId,
        sizeBytes: fileRow.size_bytes,
        mimeType: fileRow.mime_type,
      },
    } satisfies TablesInsert<"order_events">,
  ]);

  // 4) Gerçek QC tetikle (GPT-4o Vision) — mock stub kaldırıldı
  const orderId = fileRow.order_id;
  const { data: orderRow } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  const qcTriggerStatuses = ["awaiting_upload", "paid", "qc_pending"];

  if (orderRow && qcTriggerStatuses.includes(orderRow.status)) {
    if (
      orderRow.status === "awaiting_upload" ||
      orderRow.status === "paid"
    ) {
      await admin
        .from("orders")
        .update({ status: "qc_pending" })
        .eq("id", orderId);
    }
    scheduleOrderDesignQC(admin, orderId);
  }

  return NextResponse.json({
    ok: true,
    fileId: body.fileId,
    status: "analyzing",
  });
}
