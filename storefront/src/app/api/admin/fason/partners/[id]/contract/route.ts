/**
 * POST /api/admin/fason/partners/[id]/contract
 *
 * Sefa 20 May v68 (Mig 067): Sözleşme PDF upload.
 *   - Multipart form-data, single PDF file (max 10MB)
 *   - R2 bucket'a partners/{id}/contract-{timestamp}.pdf key ile
 *   - fason_partners.contract_pdf_url + contract_uploaded_at update
 *   - Önceki sözleşme dosyası SİLİNMEZ (audit izi).
 *
 * Response: { ok, key, signedUrl }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  // Multipart parse
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_form_data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "file_missing", hint: "multipart 'file' alanı zorunlu" },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "invalid_mime", hint: "Sadece PDF kabul edilir" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", hint: "Maks 10 MB" },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ts = Date.now();
  const key = `partners/${id}/contract-${ts}.pdf`;

  const upload = await uploadToR2({
    key,
    body: bytes,
    contentType: "application/pdf",
    metadata: {
      partner_id: id,
      uploaded_by: auth.user.id,
      uploaded_by_email: auth.user.email ?? "admin",
    },
  });
  if (!upload.success) {
    return NextResponse.json(
      { error: "r2_upload_failed", detail: upload.error },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("fason_partners")
    .update({
      contract_pdf_url: key,
      contract_uploaded_at: new Date().toISOString(),
      updated_by: auth.user.id,
    } as never)
    .eq("id", id);
  if (updErr) {
    return NextResponse.json(
      { error: "db_update_failed", detail: updErr.message },
      { status: 500 }
    );
  }

  // 24 saatlik signed URL döndür — admin hemen indirip kontrol edebilir
  const signedUrl = await getSignedDownloadUrl(key, 24 * 3600);

  return NextResponse.json({
    ok: true,
    key,
    signedUrl,
    size: bytes.length,
    dryRun: upload.dryRun ?? false,
  });
}
