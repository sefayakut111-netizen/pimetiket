/**
 * POST /api/design/temp-upload-init
 *
 * Sepete eklemeden ÖNCE tasarım yüklemek için. Sipariş ID henüz yok,
 * temp/<userId>/<uuid>.<ext> path'inde tutulur. 24 saatte bir cron
 * temizler.
 *
 * Akış:
 *   1. Auth check
 *   2. Body validate (originalName, sizeBytes, mimeType)
 *   3. Storage signed upload URL (designs bucket, temp/ prefix)
 *   4. Token döner (DB row henüz yok — upload-complete'te oluşur)
 *
 * NOT: design_files'tan farklı; bu temp staging. Sipariş açıldıktan
 * sonra promote edilir (callback'te).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
  getExtensionFromMime,
} from "@/lib/storage/design-files";

const InitBodySchema = z.object({
  originalName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
});

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Validate
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

  // Storage path: temp/<userId>/<uuid>.<ext>
  const fileId = crypto.randomUUID();
  const ext = getExtensionFromMime(body.mimeType);
  const storagePath = `temp/${user.id}/${fileId}.${ext}`;

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signErr || !signed) {
    console.error("[design/temp-init] sign error:", signErr);
    return NextResponse.json(
      { error: "signed_url_failed", detail: signErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    uploadUrl: signed.signedUrl,
    token: signed.token,
    storagePath,
    fileId,
  });
}
