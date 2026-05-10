/**
 * /api/admin/reviews/[id] — yorum durum/featured/homepage güncelle.
 *
 * PATCH { status?, featured?, showOnHomepage?, moderationNote? }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

interface BodyShape {
  status?: unknown;
  featured?: unknown;
  showOnHomepage?: unknown;
  moderationNote?: unknown;
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

  return NextResponse.json({ review: data });
}
