/**
 * POST /api/admin/gallery/upload-url
 *
 * Galeri için signed upload URL üretir (public-assets bucket).
 *
 * Body: { extension: 'jpg' | 'png' | 'webp' }
 * Returns: { uploadUrl, path, publicUrl }
 *
 * Client:
 *   1. Bu endpoint'i çağır → uploadUrl al
 *   2. PUT file to uploadUrl
 *   3. POST /api/admin/gallery body: { image_path: path, ... }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET = "public-assets";
const VALID_EXT = ["jpg", "jpeg", "png", "webp"] as const;

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") {
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
    VALID_EXT.includes(body.extension.toLowerCase() as never)
      ? body.extension.toLowerCase()
      : null;
  if (!ext) {
    return NextResponse.json(
      { error: "extension: jpg, png veya webp olmalı" },
      { status: 400 }
    );
  }

  // Yeni dosya path'i: gallery/<uuid>.<ext>
  const uuid =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const path = `gallery/${uuid}.${ext}`;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[admin/gallery/upload-url]", error);
    return NextResponse.json(
      { error: "Upload URL oluşturulamadı" },
      { status: 500 }
    );
  }

  // public URL (public-assets bucket public-read olduğu için)
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: pub.publicUrl,
  });
}
