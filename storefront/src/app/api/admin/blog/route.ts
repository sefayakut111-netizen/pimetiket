/**
 * /api/admin/blog — Blog yazıları CRUD
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyTitle, calculateReadMinutes } from "@/lib/blog-slug";

export const runtime = "nodejs";

export type BlogPostStatus = "draft" | "published" | "archived";

export interface BlogPostRow {
  id: string;
  slug: string;
  title_tr: string;
  title_en: string | null;
  body_tr: string;
  body_en: string | null;
  excerpt_tr: string | null;
  excerpt_en: string | null;
  category: string;
  cover_image_url: string | null;
  author_name: string | null;
  status: BlogPostStatus;
  read_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function pickOptionalString(v: unknown): string | null | undefined {
  if (v === null) return null;
  return typeof v === "string" ? v : undefined;
}

export async function GET() {
  const auth = await assertPermission("blog", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/blog] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, posts: (data ?? []) as BlogPostRow[] });
}

export async function POST(req: Request) {
  const auth = await assertPermission("blog", "create");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const title_tr = pickString(body.title_tr)?.trim();
  const body_tr_raw = pickString(body.body_tr);
  if (!title_tr || !body_tr_raw) {
    return NextResponse.json(
      { ok: false, error: "Başlık ve içerik zorunlu" },
      { status: 400 }
    );
  }
  const body_tr = body_tr_raw.trim();
  if (/\]\(\s*(javascript:|data:)/i.test(body_tr)) {
    return NextResponse.json(
      {
        ok: false,
        error: "İçerikte güvensiz bağlantı (javascript:/data:) var",
      },
      { status: 400 }
    );
  }

  const slug =
    pickString(body.slug)?.trim() ||
    slugifyTitle(title_tr);
  const status = (pickString(body.status) ?? "draft") as BlogPostStatus;
  const read_minutes =
    typeof body.read_minutes === "number"
      ? body.read_minutes
      : calculateReadMinutes(body_tr);

  const row = {
    slug,
    title_tr,
    title_en: pickOptionalString(body.title_en) ?? null,
    body_tr,
    body_en: pickOptionalString(body.body_en) ?? null,
    excerpt_tr: pickOptionalString(body.excerpt_tr) ?? null,
    excerpt_en: pickOptionalString(body.excerpt_en) ?? null,
    category: pickString(body.category)?.trim() || "genel",
    cover_image_url: pickOptionalString(body.cover_image_url) ?? null,
    author_name: pickString(body.author_name)?.trim() || "Pim Etiket",
    status,
    read_minutes,
    seo_title: pickOptionalString(body.seo_title) ?? null,
    seo_description: pickOptionalString(body.seo_description) ?? null,
    published_at:
      status === "published" ? new Date().toISOString() : null,
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    const msg =
      error.code === "23505" ? "Bu slug zaten kullanılıyor" : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, post: data as BlogPostRow });
}

export async function PATCH(req: Request) {
  const auth = await assertPermission("blog", "update");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const id = pickString(body.id);
  if (!id) {
    return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("blog_posts")
    .select("published_at, body_tr")
    .eq("id", id)
    .maybeSingle();

  const patch: Partial<import("@/lib/supabase/types").Database["public"]["Tables"]["blog_posts"]["Update"]> = {};
  const title_tr = pickString(body.title_tr);
  const body_tr = pickString(body.body_tr);
  if (title_tr) patch.title_tr = title_tr.trim();
  if (body_tr) {
    const trimmed = body_tr.trim();
    if (/\]\(\s*(javascript:|data:)/i.test(trimmed)) {
      return NextResponse.json(
        {
          ok: false,
          error: "İçerikte güvensiz bağlantı (javascript:/data:) var",
        },
        { status: 400 }
      );
    }
    patch.body_tr = trimmed;
    patch.read_minutes = calculateReadMinutes(trimmed);
  }
  if (pickString(body.slug)) patch.slug = pickString(body.slug)!.trim();
  if (pickOptionalString(body.excerpt_tr) !== undefined) {
    patch.excerpt_tr = pickOptionalString(body.excerpt_tr);
  }
  if (pickOptionalString(body.category)) patch.category = pickString(body.category)!.trim();
  if (pickOptionalString(body.cover_image_url) !== undefined) {
    patch.cover_image_url = pickOptionalString(body.cover_image_url);
  }
  if (pickOptionalString(body.seo_title) !== undefined) {
    patch.seo_title = pickOptionalString(body.seo_title);
  }
  if (pickOptionalString(body.seo_description) !== undefined) {
    patch.seo_description = pickOptionalString(body.seo_description);
  }
  if (pickString(body.status)) {
    const status = pickString(body.status) as BlogPostStatus;
    patch.status = status;
    if (status === "published" && !existing?.published_at) {
      patch.published_at = new Date().toISOString();
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Güncellenecek alan yok" }, {
      status: 400,
    });
  }

  const { data, error } = await admin
    .from("blog_posts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, post: data as BlogPostRow });
}

export async function DELETE(req: Request) {
  const auth = await assertPermission("blog", "delete");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  let id = url.searchParams.get("id");
  if (!id) {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    id = body.id ?? null;
  }
  if (!id) {
    return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("blog_posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
