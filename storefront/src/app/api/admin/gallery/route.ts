/**
 * /api/admin/gallery
 *
 * GET  — Tüm galeri öğelerini listele (admin, taslaklar dahil)
 * POST — Yeni öğe ekle (image_path, title, body, product_type, features)
 *
 * Image upload akışı:
 *   1. Client: /api/admin/gallery/upload-url → signed upload URL
 *   2. Client: PUT file to signed URL (Supabase Storage public-assets bucket)
 *   3. Client: POST /api/admin/gallery body: { image_path: "gallery/<uuid>.jpg", ... }
 *
 * Müşteri tarafı (/galeri ve anasayfa) anonim client ile direkt
 * Supabase RPC çağırır (RLS is_published=true filter).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";

export const dynamic = "force-dynamic";

interface BodyShape {
  image_path?: unknown;
  title?: unknown;
  body?: unknown;
  product_type?: unknown;
  features?: unknown;
  sort_order?: unknown;
  is_published?: unknown;
}

const VALID_PRODUCTS = ["etiket", "sticker", "mixed"] as const;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function assertAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") return null;
  return { user, role: role as "admin" | "staff" };
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = serviceClient();
  const { data, error } = await admin
    .from("gallery_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[admin/gallery GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imagePath = typeof body.image_path === "string" ? body.image_path.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const productType =
    typeof body.product_type === "string" &&
    VALID_PRODUCTS.includes(body.product_type as never)
      ? body.product_type
      : null;

  if (!imagePath || !title || !productType) {
    return NextResponse.json(
      { error: "image_path, title ve product_type zorunlu" },
      { status: 400 }
    );
  }

  const insertPayload = {
    image_path: imagePath,
    title,
    body: typeof body.body === "string" ? body.body.slice(0, 2000) : null,
    product_type: productType,
    features: typeof body.features === "string" ? body.features.slice(0, 500) : null,
    sort_order:
      typeof body.sort_order === "number" ? Math.round(body.sort_order) : 0,
    is_published:
      typeof body.is_published === "boolean" ? body.is_published : true,
    created_by: auth.user.id,
  };

  const admin = serviceClient();
  const { data, error } = await admin
    .from("gallery_items")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("[admin/gallery POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "settings.update",
    targetType: "gallery_item",
    targetId: (data as { id: string }).id,
    summary: `Galeri öğesi eklendi: ${title}`,
    detail: { product_type: productType, image_path: imagePath },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ item: data });
}
