/**
 * /api/admin/reviews/[id] — yorum güncelle.
 *
 * Sefa 17 May v34: body + display_name + rating + photos eklendi.
 * (önceden sadece status/featured/showOnHomepage/moderationNote vardı)
 *
 * PATCH {
 *   status?, featured?, showOnHomepage?, moderationNote?,
 *   body?, displayName?, rating?, productType?, photos?
 * }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";

interface PhotoEntry {
  path: string;
}

interface BodyShape {
  status?: unknown;
  featured?: unknown;
  showOnHomepage?: unknown;
  moderationNote?: unknown;
  body?: unknown;
  displayName?: unknown;
  rating?: unknown;
  productType?: unknown;
  photos?: unknown;
}

const VALID_STATUS = ["pending", "published", "rejected", "hidden"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Auth check
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

  // Build update payload
  const update: Record<string, unknown> = {};
  if (typeof body.status === "string" && VALID_STATUS.includes(body.status)) {
    update.status = body.status;
    update.moderated_at = new Date().toISOString();
    update.moderated_by = user.id;
    if (body.status === "published") {
      // Default: published yorumlar anasayfada görünür (admin sonra kapatabilir)
      if (typeof body.showOnHomepage !== "boolean") {
        update.show_on_homepage = true;
      }
    }
  }
  if (typeof body.featured === "boolean") {
    update.featured = body.featured;
  }
  if (typeof body.showOnHomepage === "boolean") {
    update.show_on_homepage = body.showOnHomepage;
  }
  if (typeof body.moderationNote === "string") {
    update.moderation_note = body.moderationNote;
  }
  // Sefa 17 May v34: body (cümle), display_name, rating, photos edit
  if (typeof body.body === "string") {
    const trimmed = body.body.trim();
    if (trimmed.length < 10 || trimmed.length > 800) {
      return NextResponse.json(
        { error: "Yorum 10-800 karakter arası olmalı" },
        { status: 400 }
      );
    }
    update.body = trimmed;
  }
  if (typeof body.displayName === "string") {
    const trimmed = body.displayName.trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      return NextResponse.json(
        { error: "Ad 1-80 karakter olmalı" },
        { status: 400 }
      );
    }
    update.display_name = trimmed;
  }
  if (typeof body.rating === "number" && Number.isInteger(body.rating)) {
    if (body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: "Yıldız 1-5 arası olmalı" },
        { status: 400 }
      );
    }
    update.rating = body.rating;
  }
  if (
    typeof body.productType === "string" &&
    ["etiket", "sticker"].includes(body.productType)
  ) {
    update.product_type = body.productType;
  }
  if (Array.isArray(body.photos)) {
    // Normalize: { path: string } only, max 2
    const normalized: PhotoEntry[] = body.photos
      .filter(
        (p): p is { path: string } =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as { path?: unknown }).path === "string"
      )
      .map((p) => ({ path: p.path }))
      .slice(0, 2);
    update.photos = normalized;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  // Service role ile update
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("reviews")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[admin/reviews PATCH] error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  // Audit log — sadece status değişiklikleri için
  if (update.status) {
    const auditAction =
      update.status === "published"
        ? ("review.approve" as const)
        : update.status === "rejected"
          ? ("review.reject" as const)
          : null;
    if (auditAction) {
      await logServerAudit(admin, {
        actorId: user.id,
        actorEmail: user.email ?? null,
        actorRole: role === "admin" ? "admin" : "staff",
        action: auditAction,
        targetType: "review",
        targetId: id,
        summary: `Yorum ${update.status === "published" ? "yayınlandı" : "reddedildi"} (#${id.slice(0, 8)})`,
        detail: {
          status: update.status,
          note: typeof body.moderationNote === "string" ? body.moderationNote : null,
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
    }
  }

  return NextResponse.json({ review: data });
}
