/**
 * POST /api/partner/orders/[id]/items/[itemId]/upload-revision
 *
 * Sefa 23 May v68 (Partner P5 — Mod B):
 * Partner kendi masaüstü programıyla (Illustrator / CorelDRAW vs)
 * revize ettiği dosyayı sisteme yükler. Bu dosya direkt müşteri onayına
 * gider (admin loop'u BYPASS — partner'a güveniyoruz).
 *
 * Multipart body: file=<PNG|PDF|AI|SVG>, note?=<açıklama>
 *
 * Akış:
 *   1. Auth: role='partner' + cross-tenant guard
 *   2. Dosya validate (mime, max 50MB)
 *   3. Supabase Storage upload (designs/{userId}/{orderId}/{itemId}/revised-{ts}.{ext})
 *   4. design_files INSERT:
 *      - version = (mevcut max + 1)
 *      - status = 'approved' (fason/download ile uyumlu)
 *      - revised_by_partner_id = partner_id
 *      - revised_at = now
 *   5. Önceki design_files'ı (aynı order_item_id) status='superseded'
 *   6. order_items.proof_status = 'partner_revised'
 *      + partner_decided_by/at/note
 *   7. order_events: 'partner_uploaded_revision'
 *   8. TODO: müşteriye mail (proof_pending_again template)
 *
 * Body limits:
 *   - File size: max 50MB
 *   - MIME: image/png, image/jpeg, image/svg+xml, application/pdf,
 *           application/postscript (AI), application/illustrator
 *
 * Geri dönüş: { ok, design_file_id, version, file_name }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";
import { sendOrderProofRequired } from "@/lib/mail/notifications";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
  "application/x-photoshop",
  "image/vnd.adobe.photoshop",
]);
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/postscript": "ai",
  "application/illustrator": "ai",
  "application/x-photoshop": "psd",
  "image/vnd.adobe.photoshop": "psd",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: rawOrderId, itemId } = await params;
  if (!rawOrderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  // Auth — preview modunda yazma yasak
  const ctx = await resolvePartnerContext();
  if (!ctx || ctx.isPreview || !ctx.partnerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId;
  const userId = ctx.userId;

  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("partner_id, name")
    .eq("partner_id", partnerId)
    .limit(1)
    .maybeSingle();
  const contact = contactRow as { partner_id: string; name: string } | null;
  if (!contact) {
    return NextResponse.json(
      { error: "partner_link_missing" },
      { status: 404 }
    );
  }

  // Canonical order + cross-tenant guard
  const { data: orderRow } = await admin
    .from("orders")
    .select("id, user_id")
    .ilike("id", rawOrderId)
    .maybeSingle();
  const order = orderRow as { id: string; user_id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  const asg = await assertActivePartnerAssignment(
    admin,
    order.id,
    partnerId,
    "id, fason_partner_id, status"
  );
  if (!asg.ok) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }
  const assignment = asg.assignment;

  // Item validate
  const { data: itemRow } = await admin
    .from("order_items")
    .select("id, title")
    .eq("id", itemId)
    .eq("order_id", order.id)
    .maybeSingle();
  const item = itemRow as { id: string; title: string } | null;
  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 });
  }

  // Multipart parse
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_multipart",
        detail: err instanceof Error ? err.message : "Bilinmeyen",
      },
      { status: 400 }
    );
  }
  const file = formData.get("file");
  const note =
    typeof formData.get("note") === "string"
      ? (formData.get("note") as string)
      : null;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file_missing", message: "file alanı zorunlu" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `Dosya max ${MAX_BYTES / 1024 / 1024}MB olabilir`,
      },
      { status: 413 }
    );
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      {
        error: "unsupported_mime",
        message: `Desteklenen formatlar: PNG, JPG, SVG, PDF, AI, PSD. Gelen: ${file.type}`,
      },
      { status: 415 }
    );
  }

  // Önceki design_files'ın max version'ı
  type ExistingRow = { version: number };
  const { data: existingRows } = await admin
    .from("design_files")
    .select("version")
    .eq("order_item_id", itemId)
    .order("version", { ascending: false })
    .limit(1);
  const existing = (existingRows as ExistingRow[] | null) ?? [];
  const nextVersion = (existing[0]?.version ?? 0) + 1;

  // Storage upload — yapı: designs/{order_user_id}/{orderId}/{itemId}/revised-{ts}-v{N}.{ext}
  const ext = MIME_EXT[file.type] ?? "bin";
  const ts = Date.now();
  const storagePath = `${order.user_id}/${order.id}/${itemId}/revised-${ts}-v${nextVersion}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) {
    console.error("[partner/upload-revision] storage upload error:", uploadErr);
    return NextResponse.json(
      { error: "upload_failed", detail: uploadErr.message },
      { status: 500 }
    );
  }

  // Önceki design_files'ı superseded yap
  await admin
    .from("design_files")
    .update({ status: "superseded" })
    .eq("order_item_id", itemId)
    .neq("status", "superseded");

  // Yeni design_files INSERT
  const fileName = file.name || `revised-v${nextVersion}.${ext}`;
  const { data: insertRow, error: insertErr } = await admin
    .from("design_files")
    .insert([
      {
        order_id: order.id,
        order_item_id: itemId,
        user_id: order.user_id,
        storage_path: storagePath,
        original_name: fileName,
        mime_type: file.type,
        size_bytes: file.size,
        version: nextVersion,
        status: "approved",
        revised_by_partner_id: partnerId,
        revised_at: new Date().toISOString(),
      },
    ])
    .select("id")
    .single();
  if (insertErr || !insertRow) {
    console.error(
      "[partner/upload-revision] design_files insert error:",
      insertErr
    );
    return NextResponse.json(
      { error: "design_insert_failed", detail: insertErr?.message },
      { status: 500 }
    );
  }
  const designFileId = (insertRow as { id: string }).id;

  // order_items.proof_status = 'partner_revised'
  await admin
    .from("order_items")
    .update({
      proof_status: "partner_revised",
      partner_decided_by: userId,
      partner_decided_at: new Date().toISOString(),
      partner_decision_note: note ?? "Partner kendi dosyasıyla revize",
    })
    .eq("id", itemId);

  // Audit
  await admin.from("order_events").insert([
    {
      order_id: order.id,
      event_type: "partner_uploaded_revision",
      actor_id: userId,
      actor_role: "partner",
      summary: `${contact.name} (partner) ${item.title} için kendi dosyasıyla revize yükledi (v${nextVersion})`,
      detail: {
        item_id: itemId,
        item_title: item.title,
        design_file_id: designFileId,
        version: nextVersion,
        file_name: fileName,
        mime_type: file.type,
        size_bytes: file.size,
        partner_id: partnerId,
        note: note ?? null,
      },
    },
  ]);

  // TODO (Sefa 23 May v68): müşteriye mail
  void sendOrderProofRequired({
    userId: order.user_id,
    orderId: order.id,
    idempotencyKey: `proof_revise:${order.id}:${designFileId}`,
  }).catch((err) => {
    console.error("[partner/upload-revision] proof mail:", err);
  });

  return NextResponse.json({
    ok: true,
    design_file_id: designFileId,
    version: nextVersion,
    file_name: fileName,
    message: "Revize dosyası yüklendi, müşteri yeniden inceleyecek",
  });
}
