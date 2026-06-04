/**
 * POST /api/admin/blog/upload-cover
 *
 * Blog kapak görseli için signed upload URL (public-assets bucket).
 * Galeri upload-url ile aynı akış; path: blog/covers/{uuid}.{ext}
 *
 * Body: { extension: 'jpg' | 'png' | 'webp' }
 * Returns: { uploadUrl, path, publicUrl }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET = "public-assets";
const VALID_EXT = ["jpg", "jpeg", "png", "webp"] as const;

export async function POST(req: Request) {
  const auth = await assertPermission("blog", "create");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { extension?: unknown };
  try {
    body = (await req.json()) as { extension?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ext =
    typeof body.extension === "string" &&
    (VALID_EXT as readonly string[]).includes(body.extension.toLowerCase())
      ? body.extension.toLowerCase()
      : null;
  if (!ext) {
    return NextResponse.json(
      { error: "extension: jpg, png veya webp olmalı" },
      { status: 400 }
    );
  }

  const uuid =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const normalizedExt = ext === "jpeg" ? "jpg" : ext;
  const path = `blog/covers/${uuid}.${normalizedExt}`;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[admin/blog/upload-cover]", error);
    return NextResponse.json(
      { error: "Upload URL oluşturulamadı" },
      { status: 500 }
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: pub.publicUrl,
  });
}
