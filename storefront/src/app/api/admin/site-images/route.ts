/**
 * /api/admin/site-images — slot-bazlı görsel CRUD
 *
 * GET   /api/admin/site-images               → tüm slot kayıtları
 * POST  /api/admin/site-images               → upload (multipart formdata)
 * PATCH /api/admin/site-images?slot=...      → meta (alt_text/title/link_url/is_active) güncelle
 * DELETE /api/admin/site-images?slot=...     → silme (storage + DB)
 *
 * Upload akışı:
 *   1. multipart formdata: file + slot + alt_text + title? + link_url?
 *   2. Magic-byte mime check (spoof koruması)
 *   3. Storage upload: public-assets/site-images/{slot}/{uuid}.{ext}
 *   4. Eski görsel varsa Storage'tan sil
 *   5. site_images tablosunda upsert (slot unique)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AllowedMime } from "@/lib/storage/design-files";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import { maybeSanitizeUploadBytes } from "@/lib/upload/sanitize-svg";
import type { TablesUpdate } from "@/lib/supabase/types";
import { getSlotMeta } from "@/lib/site-image-slots";

const BUCKET = "public-assets";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

// ============================================================
// GET — Tüm slot kayıtlarını listele
// ============================================================
export async function GET() {
  const auth = await assertPermission("site_images", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("site_images")
    .select(
      "slot, storage_path, alt_text, title, link_url, is_active, width, height, size_bytes, mime_type, updated_at"
    )
    .order("slot");

  if (error) {
    console.error("[admin/site-images] GET error:", error);
    return NextResponse.json(
      { error: "list_failed", detail: error.message },
      { status: 500 }
    );
  }

  type Row = {
    slot: string;
    storage_path: string;
    alt_text: string | null;
    title: string | null;
    link_url: string | null;
    is_active: boolean;
    width: number | null;
    height: number | null;
    size_bytes: number | null;
    mime_type: string | null;
    updated_at: string;
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const items = ((data ?? []) as Row[]).map((r) => ({
    slot: r.slot,
    storagePath: r.storage_path,
    publicUrl: `${url}/storage/v1/object/public/${BUCKET}/${r.storage_path}`,
    altText: r.alt_text,
    title: r.title,
    linkUrl: r.link_url,
    isActive: r.is_active,
    width: r.width,
    height: r.height,
    sizeBytes: r.size_bytes,
    mimeType: r.mime_type,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ items });
}

// ============================================================
// POST — Upload (multipart)
// ============================================================
export async function POST(req: Request) {
  const auth = await assertPermission("site_images", "create");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_form_data" },
      { status: 400 }
    );
  }

  const slot = String(formData.get("slot") ?? "").trim();
  const altText = (formData.get("alt_text") as string | null) ?? null;
  const title = (formData.get("title") as string | null) ?? null;
  const linkUrl = (formData.get("link_url") as string | null) ?? null;
  const file = formData.get("file");

  // Slot validation — catalog'da kayıtlı mı
  if (!slot || !getSlotMeta(slot)) {
    return NextResponse.json(
      { error: "invalid_slot", detail: `Slot "${slot}" tanımlı değil` },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file" },
      { status: 400 }
    );
  }

  // Size + claimed mime check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: "file_too_large",
        detail: `Max ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      },
      { status: 400 }
    );
  }

  const claimedMime = file.type;
  if (!(ALLOWED_MIME as readonly string[]).includes(claimedMime)) {
    return NextResponse.json(
      {
        error: "invalid_mime",
        detail: `Allowed: ${ALLOWED_MIME.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Magic-byte check (SVG dışında — SVG için XML scan zaten var)
  let buffer: ArrayBufferLike;
  try {
    buffer = maybeSanitizeUploadBytes(
      await file.arrayBuffer(),
      claimedMime,
      file.name
    ).buffer;
  } catch (svgErr) {
    console.error("[admin/site-images] svg sanitize:", svgErr);
    return NextResponse.json(
      { error: "svg_sanitize_failed", detail: "SVG güvenlik kontrolünden geçemedi." },
      { status: 400 }
    );
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

  const admin = createAdminClient();

  // Eski görsel varsa Storage'tan sil
  const { data: existing } = await admin
    .from("site_images")
    .select("storage_path")
    .eq("slot", slot)
    .maybeSingle();
  if (existing) {
    const oldPath = (existing as { storage_path: string }).storage_path;
    if (oldPath) {
      await admin.storage.from(BUCKET).remove([oldPath]);
    }
  }

  // Path: site-images/{slot}/{timestamp}.{ext}
  const ext = (() => {
    if (claimedMime === "image/jpeg") return "jpg";
    if (claimedMime === "image/png") return "png";
    if (claimedMime === "image/webp") return "webp";
    if (claimedMime === "image/svg+xml") return "svg";
    return "bin";
  })();
  const storagePath = `site-images/${slot}/${Date.now()}.${ext}`;

  // Upload
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: claimedMime,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[admin/site-images] upload error:", uploadErr);
    return NextResponse.json(
      { error: "upload_failed", detail: uploadErr.message },
      { status: 500 }
    );
  }

  // DB upsert
  const { error: dbErr } = await admin
    .from("site_images")
    .upsert(
      {
        slot,
        storage_path: storagePath,
        alt_text: altText,
        title,
        link_url: linkUrl,
        is_active: true,
        size_bytes: file.size,
        mime_type: claimedMime,
        updated_by: auth.user.id,
      },
      { onConflict: "slot" }
    );

  if (dbErr) {
    // Storage'a yüklendi ama DB başarısız — cleanup
    await admin.storage.from(BUCKET).remove([storagePath]);
    console.error("[admin/site-images] db upsert error:", dbErr);
    return NextResponse.json(
      { error: "db_upsert_failed", detail: dbErr.message },
      { status: 500 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return NextResponse.json({
    ok: true,
    slot,
    storagePath,
    publicUrl: `${url}/storage/v1/object/public/${BUCKET}/${storagePath}`,
  });
}

// ============================================================
// PATCH — Meta güncelle (alt_text, title, link_url, is_active)
// ============================================================
const PatchSchema = z.object({
  alt_text: z.string().max(500).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  link_url: z
    .string()
    .url()
    .max(2000)
    .nullable()
    .optional()
    .or(z.literal("")),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const auth = await assertPermission("site_images", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const slot = new URL(req.url).searchParams.get("slot");
  if (!slot || !getSlotMeta(slot)) {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_body", detail: e instanceof Error ? e.message : "" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const updates: TablesUpdate<"site_images"> = { updated_by: auth.user.id };
  if (body.alt_text !== undefined) updates.alt_text = body.alt_text;
  if (body.title !== undefined) updates.title = body.title;
  if (body.link_url !== undefined) {
    updates.link_url = body.link_url === "" ? null : body.link_url;
  }
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { error } = await admin
    .from("site_images")
    .update(updates)
    .eq("slot", slot);

  if (error) {
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, slot });
}

// ============================================================
// DELETE — Slot görselini sil (storage + DB)
// ============================================================
export async function DELETE(req: Request) {
  const auth = await assertPermission("site_images", "delete");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const slot = new URL(req.url).searchParams.get("slot");
  if (!slot || !getSlotMeta(slot)) {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Storage path al
  const { data: existing } = await admin
    .from("site_images")
    .select("storage_path")
    .eq("slot", slot)
    .maybeSingle();

  if (existing) {
    const path = (existing as { storage_path: string }).storage_path;
    if (path) {
      await admin.storage.from(BUCKET).remove([path]);
    }
    await admin.from("site_images").delete().eq("slot", slot);
  }

  return NextResponse.json({ ok: true, slot });
}
