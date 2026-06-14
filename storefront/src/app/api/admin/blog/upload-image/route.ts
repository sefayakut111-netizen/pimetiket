/**
 * POST /api/admin/blog/upload-image
 *
 * Blog inline görsel — server multipart upload + magic-byte doğrulama.
 * Path: public-assets/blog/inline/{uuid}.{ext}
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AllowedMime } from "@/lib/storage/design-files";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import { maybeSanitizeUploadBytes } from "@/lib/upload/sanitize-svg";

export const dynamic = "force-dynamic";

const BUCKET = "public-assets";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function POST(req: Request) {
  const auth = await assertPermission("blog", "create");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "file_too_large", detail: "Max 5 MB" },
      { status: 413 }
    );
  }

  const claimedMime = file.type;
  if (!(ALLOWED_MIME as readonly string[]).includes(claimedMime)) {
    return NextResponse.json(
      {
        error: "invalid_mime",
        detail: `Allowed: ${ALLOWED_MIME.join(", ")}`,
      },
      { status: 415 }
    );
  }

  let buffer: ArrayBufferLike;
  try {
    buffer = maybeSanitizeUploadBytes(
      await file.arrayBuffer(),
      claimedMime,
      file.name
    ).buffer;
  } catch (err) {
    console.error("[admin/blog/upload-image] sanitize:", err);
    return NextResponse.json({ error: "sanitize_failed" }, { status: 400 });
  }

  const bytes = new Uint8Array(buffer);
  const magic = detectMimeFromMagicBytes(
    bytes.slice(0, 512),
    claimedMime as AllowedMime
  );
  if (!magic.matchesClaim) {
    return NextResponse.json(
      {
        error: "mime_mismatch",
        detail: `Beyan: ${claimedMime}, gerçek: ${magic.detected ?? "bilinmiyor"}`,
      },
      { status: 400 }
    );
  }

  const uuid =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const path = `blog/inline/${uuid}.${extForMime(claimedMime)}`;

  const admin = createAdminClient();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: claimedMime,
      upsert: false,
    });

  if (uploadErr) {
    console.error("[admin/blog/upload-image]", uploadErr);
    return NextResponse.json(
      { error: "upload_failed", detail: uploadErr.message },
      { status: 500 }
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ publicUrl: pub.publicUrl });
}
