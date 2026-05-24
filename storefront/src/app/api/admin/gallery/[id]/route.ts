/**
 * /api/admin/gallery/[id]
 *
 * PATCH  — Öğeyi güncelle (title, body, features, sort_order, is_published)
 * DELETE — Öğeyi sil (Storage'dan dosya da silinir best-effort)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";

export const dynamic = "force-dynamic";

const VALID_PRODUCTS = ["etiket", "sticker", "mixed"] as const;
const PUBLIC_BUCKET = "public-assets";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("gallery", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID eksik" }, { status: 400 });

  interface PatchBody {
    title?: unknown;
    body?: unknown;
    product_type?: unknown;
    features?: unknown;
    sort_order?: unknown;
    is_published?: unknown;
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") update.title = body.title.trim().slice(0, 200);
  if (body.body === null || typeof body.body === "string") {
    update.body = body.body === null ? null : (body.body as string).slice(0, 2000);
  }
  if (
    typeof body.product_type === "string" &&
    VALID_PRODUCTS.includes(body.product_type as never)
  ) {
    update.product_type = body.product_type;
  }
  if (body.features === null || typeof body.features === "string") {
    update.features =
      body.features === null ? null : (body.features as string).slice(0, 500);
  }
  if (typeof body.sort_order === "number") {
    update.sort_order = Math.round(body.sort_order);
  }
  if (typeof body.is_published === "boolean") {
    update.is_published = body.is_published;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  const admin = serviceClient();
  const { data, error } = await admin
    .from("gallery_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/gallery PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "settings.update",
    targetType: "gallery_item",
    targetId: id,
    summary: `Galeri öğesi güncellendi: ${Object.keys(update).join(", ")}`,
    detail: update,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ item: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("gallery", "delete");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID eksik" }, { status: 400 });

  const admin = serviceClient();

  // Önce kaydı al (Storage path için)
  const { data: existing } = await admin
    .from("gallery_items")
    .select("id, image_path, title")
    .eq("id", id)
    .maybeSingle();
  const row = existing as { id: string; image_path: string; title: string } | null;
  if (!row) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  // DB'den sil
  const { error: delErr } = await admin
    .from("gallery_items")
    .delete()
    .eq("id", id);
  if (delErr) {
    console.error("[admin/gallery DELETE]", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Storage'dan dosyayı sil (best-effort, hata kritik değil)
  try {
    await admin.storage.from(PUBLIC_BUCKET).remove([row.image_path]);
  } catch (err) {
    console.warn("[admin/gallery] storage delete failed:", err);
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "settings.update",
    targetType: "gallery_item",
    targetId: id,
    summary: `Galeri öğesi silindi: ${row.title}`,
    detail: { image_path: row.image_path },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
