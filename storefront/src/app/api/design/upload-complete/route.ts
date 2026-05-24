/**
 * POST /api/design/upload-complete
 *
 * Client signed URL'e PUT ettikten sonra çağırır. Server:
 *   - design_files satırını günceller (sha256 + ai_check başlat)
 *   - AI ön-kontrol pipeline'ı tetikler (P0-5.5 stub)
 *   - order_events 'file_uploaded' log
 *
 * Body: { fileId, sha256?, magicByteOk? }
 *
 * Magic-byte check şu an stub — ileride server-side dosyayı download
 * edip ilk N byte'ını analiz ederiz (PDF: %PDF, PNG: 89 50 4E 47, vs).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import type { AllowedMime } from "@/lib/storage/design-files";

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

  // 2) Status'u 'analyzing'e geçir + sha256 set et
  const { error: updateErr } = await admin
    .from("design_files")
    .update({
      status: "analyzing",
      sha256: body.sha256 ?? null,
    } as never)
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
    },
  ] as never);

  // 4) AI ön-kontrol pipeline tetikle (P0-5.5 — stub)
  // Production'da: queue (BullMQ / Inngest / pg_cron) + worker
  // Şimdilik: inline mock + status update.
  // fire-and-forget, response bekletmesin
  void runDesignAiCheck(body.fileId).catch((err) =>
    console.error("[design/ai-check] failed:", err)
  );

  return NextResponse.json({
    ok: true,
    fileId: body.fileId,
    status: "analyzing",
  });
}

// ============================================================
// AI Pre-Check Pipeline (STUB — P0-5.5)
// ============================================================
//
// Gerçek implementation için:
//   - PDF: Ghostscript ile DPI extract, Adobe FDK ile color profile
//   - PNG/JPG: ImageMagick `identify -format` ile DPI/colorspace
//   - AI/EPS: PostScript parser
//   - SVG: viewBox + colors (kontrol için CMYK YOK uyarısı)
//   - Bleed: PDF mediabox vs trimbox karşılaştırma
//
// Bunlar Edge function olamaz (binary tools gerekir). Nitelikli
// alternatif: Cloud Run / Lambda + container, queue ile tetiklenir.
// ============================================================

interface AiCheckFlag {
  kind: "ok" | "warning" | "error";
  message: string;
}

async function runDesignAiCheck(fileId: string): Promise<void> {
  const admin = createAdminClient();

  // Magic-byte content validation — Sefa 23 May v68 (P1.2):
  // Müşteri signed URL'e PUT etti, mimeType iddiası design_files satırında.
  // Storage'tan ilk 64 byte indir, gerçek MIME ile karşılaştır. Uyumsuzsa
  // dosyayı 'rejected' status'una geçir + order'a flag at.
  const flags: AiCheckFlag[] = [];
  try {
    const { data: fileMeta } = await admin
      .from("design_files")
      .select("storage_path, mime_type, order_id")
      .eq("id", fileId)
      .single();
    const meta = fileMeta as unknown as {
      storage_path: string;
      mime_type: string;
      order_id: string;
    } | null;

    if (meta) {
      const { data: blob } = await admin.storage
        .from("designs")
        .download(meta.storage_path);
      if (blob) {
        const headerBytes = new Uint8Array(
          await blob.arrayBuffer()
        ).slice(0, 64);
        const magic = detectMimeFromMagicBytes(
          headerBytes,
          meta.mime_type as AllowedMime
        );
        if (!magic.matchesClaim) {
          console.warn("[design/ai-check] magic-byte mismatch", {
            fileId,
            claimed: meta.mime_type,
            detected: magic.detected,
            label: magic.label,
          });
          await admin
            .from("design_files")
            .update({
              status: "rejected",
              ai_check: {
                flags: [
                  {
                    kind: "error",
                    message: `Dosya içeriği MIME ile uyumsuz (iddia: ${meta.mime_type}, gerçek: ${magic.label}).`,
                  },
                ],
              } as never,
            } as never)
            .eq("id", fileId);
          await admin.from("order_events").insert([
            {
              order_id: meta.order_id,
              event_type: "design_rejected",
              actor_role: "system",
              summary: "Tasarım dosyası magic-byte kontrolünden geçemedi.",
              detail: {
                fileId,
                claimed: meta.mime_type,
                detected: magic.detected,
                label: magic.label,
              },
            },
          ] as never);
          return; // Bundan sonra AI check yapma
        }
      }
    }
  } catch (err) {
    console.error("[design/ai-check] magic-byte check failed:", err);
    // Magic-byte check fail olsa bile AI check devam etsin (mevcut davranış)
  }

  // Mock gecikme — gerçek pipeline 10-30sn sürer
  await new Promise((r) => setTimeout(r, 1500));

  // Mock flag set — production'da gerçek analiz
  flags.push(
    { kind: "ok", message: "Çözünürlük uygun (mock)" },
    { kind: "ok", message: "CMYK renk uzayı (mock)" }
  );

  // %20 ihtimalle warning ekle (test için)
  if (Math.random() < 0.2) {
    flags.push({
      kind: "warning",
      message: "Kenar boşluğu 2mm'in altında — kesim kayması riskli",
    });
  }

  const hasError = flags.some((f) => f.kind === "error");
  const hasWarning = flags.some((f) => f.kind === "warning");
  const newStatus = hasError
    ? "qc_failed"
    : hasWarning
      ? "qc_warned"
      : "qc_passed";

  await admin
    .from("design_files")
    .update({
      status: newStatus,
      ai_check: { flags } as never,
    } as never)
    .eq("id", fileId);

  // Order durumunu da güncelle (qc_pending → qc_flagged eğer warning/error)
  if (hasError || hasWarning) {
    const { data: file } = await admin
      .from("design_files")
      .select("order_id")
      .eq("id", fileId)
      .single();
    if (file) {
      const orderId = (file as unknown as { order_id: string }).order_id;
      await admin
        .from("orders")
        .update({ status: "qc_flagged" } as never)
        .eq("id", orderId);
      await admin.from("order_events").insert([
        {
          order_id: orderId,
          event_type: "qc_flagged",
          status_after: "qc_flagged",
          actor_role: "system",
          summary: "AI ön-kontrolde uyarı tespit edildi.",
          detail: { fileId, flags },
        },
      ] as never);
    }
  }
}
