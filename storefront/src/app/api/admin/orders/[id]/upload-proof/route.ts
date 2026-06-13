/**
 * /api/admin/orders/[id]/upload-proof — Operatör prova yükle.
 *
 * POST FormData { file: File }
 * - File → Supabase Storage `designs/proofs/<orderId>/<timestamp>.<ext>`
 * - orders.proof_storage_path + proof_uploaded_at + proof_uploaded_by set
 * - orders.status → proof_pending (eğer operator_review veya öncesindeyse)
 * - order_events 'proof_uploaded' insert
 *
 * Auth: admin/staff role gerekli.
 * Max size: 30 MB
 * Allowed types: PDF, PNG, JPG
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionOrderStatus, transitionHttpStatus } from "@/lib/db/transition-order-status";
import { logOrderEvent } from "@/lib/order-events-server";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import type { AllowedMime } from "@/lib/storage/design-files";

const MAX_SIZE = 30 * 1024 * 1024;
const ALLOWED_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

function getExtension(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      return "bin";
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

  // Auth
  const auth = await assertPermission("proof", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  // Parse form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData okunamadı" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `Dosya çok büyük (max ${MAX_SIZE / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }
  if (!(ALLOWED_MIMES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: `Format desteklenmiyor (${file.type}). PDF/PNG/JPG kabul edilir` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Sipariş var mı?
  const { data: existing, error: existingErr } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (existingErr || !existing) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  // Sefa kuralı (12 May P0 audit): teslim/kargo/iptal sipariş'e prova
  // yüklenmemeli. Aksi halde sipariş kötü duruma döner + 36h auto-refund
  // cron iptal başlatabilir.
  const ALLOWED_STATUSES = [
    "paid",
    "qc_pending",
    "qc_flagged",
    "operator_review",
    "proof_pending",
  ];
  const currentStatus = (existing as { status: string }).status;
  if (!ALLOWED_STATUSES.includes(currentStatus)) {
    return NextResponse.json(
      {
        error: `${currentStatus} durumundaki siparişe prova yüklenemez. (İzinli: ${ALLOWED_STATUSES.join(", ")})`,
      },
      { status: 409 }
    );
  }

  // Magic-byte doğrulama — Sefa 23 May v68 (P1.2):
  // Client MIME (file.type) yalnız iddia; bytes'tan canonical MIME oku.
  // Yanlış uzantı + zararlı içerik (PDF iddiasıyla .exe gibi) bypass'ını engeller.
  const fileBytes = await file.arrayBuffer();
  const headerBytes = new Uint8Array(fileBytes).slice(0, 64);
  const magic = detectMimeFromMagicBytes(
    headerBytes,
    file.type as AllowedMime
  );
  if (!magic.matchesClaim) {
    console.warn("[upload-proof] magic-byte reject", {
      orderId,
      claimed: file.type,
      detected: magic.detected,
      label: magic.label,
      adminUserId: auth.user.id,
    });
    return NextResponse.json(
      {
        error: "file_content_mismatch",
        detail: `Dosya içeriği MIME ile uyumsuz (iddia: ${file.type}, gerçek: ${magic.label}). Dosya kabul edilmedi.`,
      },
      { status: 400 }
    );
  }

  // Storage'a yükle
  const ext = getExtension(file.type);
  const ts = Date.now();
  const storagePath = `proofs/${orderId}/${ts}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("designs")
    .upload(storagePath, fileBytes, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) {
    console.error("[upload-proof] storage error:", uploadErr);
    return NextResponse.json(
      { error: "Yükleme başarısız: " + uploadErr.message },
      { status: 500 }
    );
  }

  // Status → proof_pending (RPC), ardından yalnızca prova kolonları
  if (currentStatus !== "proof_pending") {
    const statusResult = await transitionOrderStatus(admin, {
      orderId,
      to: "proof_pending",
      from: currentStatus as "paid" | "qc_pending" | "qc_flagged" | "operator_review",
      mode: "forward",
      actorId: auth.user.id,
      actorRole: auth.role === "admin" ? "admin" : "staff",
      eventType: "proof_uploaded",
      summary: `Operatör prova dosyası yükledi: ${file.name}`,
      detail: {
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        storagePath,
      },
    });
    if (!statusResult.ok) {
      await admin.storage.from("designs").remove([storagePath]);
      return NextResponse.json(
        { error: statusResult.error },
        { status: transitionHttpStatus(statusResult.error) }
      );
    }
  } else {
    await logOrderEvent(admin, {
      orderId,
      eventType: "proof_uploaded",
      statusAfter: "proof_pending",
      actorId: auth.user.id,
      actorRole: auth.role === "admin" ? "admin" : "staff",
      summary: `Operatör prova dosyası yeniden yükledi: ${file.name}`,
      detail: {
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        storagePath,
        reupload: true,
      },
    });
  }

  const { error: updateErr } = await admin
    .from("orders")
    .update({
      proof_storage_path: storagePath,
      proof_uploaded_at: new Date().toISOString(),
      proof_uploaded_by: auth.user.id,
    })
    .eq("id", orderId);
  if (updateErr) {
    console.error("[upload-proof] update error:", updateErr);
    // Storage'tan geri al
    await admin.storage.from("designs").remove([storagePath]);
    return NextResponse.json(
      { error: "Sipariş güncellenemedi: " + updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    storagePath,
    status: "proof_pending",
  });
}
