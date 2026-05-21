/**
 * POST /api/cart/upload-preview
 *
 * Sefa 21 May v68 — Cart design preview upload proxy.
 *
 * MİMARİ: Client doğrudan Supabase Storage'a yazmıyor (RLS path-strict
 * policy nedeniyle Authorization header sorunu). Bunun yerine:
 *   Client (FormData) ──POST──► bu endpoint ──service_role──► Storage
 *
 * Kazançlar:
 *   - RLS bypass (service_role) → policy değiştirmeye gerek yok
 *   - Server tarafında auth, MIME, size, path validation
 *   - Bucket public read flag'i kalır → URL'ler kalıcı erişilir
 *
 * Request: multipart/form-data
 *   - file: image/png blob (max 5 MB)
 *   - design_id: string (UUID veya local-<uuid>) — storage path için
 *
 * Response:
 *   200 { ok: true, url: "https://...supabase.co/storage/.../public/..." }
 *   400 { ok: false, error: "validation: <reason>" }
 *   401 { ok: false, error: "unauthorized" }
 *   500 { ok: false, error: "<message>" }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "design-previews";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/png"];
// design_id formatı: UUID veya "local-<UUID>" — alfanumerik + tire
const DESIGN_ID_RE = /^(local-)?[a-f0-9-]{36}$/i;

export async function POST(req: Request) {
  // ─── 1. Auth ───
  let userId: string;
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }
    userId = user.id;
  } catch {
    return NextResponse.json(
      { ok: false, error: "auth_error" },
      { status: 401 }
    );
  }

  // ─── 2. FormData parse ───
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "validation: invalid_form_data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const designId = formData.get("design_id");

  // ─── 3. Validate ───
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "validation: file_missing" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      {
        ok: false,
        error: `validation: file_too_large (max ${MAX_SIZE} bytes)`,
      },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `validation: invalid_mime (got ${file.type}, expected image/png)`,
      },
      { status: 400 }
    );
  }
  if (typeof designId !== "string" || !DESIGN_ID_RE.test(designId)) {
    return NextResponse.json(
      { ok: false, error: "validation: invalid_design_id" },
      { status: 400 }
    );
  }

  // ─── 4. Storage upload (service_role, RLS bypass) ───
  const admin = createAdminClient();
  const path = `${userId}/${designId}.png`;

  try {
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "31536000", // 1 yıl
      });

    if (uploadErr) {
      console.error("[upload-preview] storage error:", uploadErr);
      return NextResponse.json(
        { ok: false, error: uploadErr.message },
        { status: 500 }
      );
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      ok: true,
      url: pub.publicUrl,
      path,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    console.error("[upload-preview] exception:", msg);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
