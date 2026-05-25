/**
 * GET /api/blog — Yayınlanmış blog yazıları (public)
 */

import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/lib/blog-posts";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "10", 10), 1),
    50
  );

  const posts = (await getPublishedPosts()).slice(0, limit).map((p) => ({
    slug: p.slug,
    title_tr: p.title,
    excerpt_tr: p.excerpt,
    category: p.category,
    read_minutes: p.readMinutes,
    cover_image_url: p.coverImageUrl ?? undefined,
  }));

  return NextResponse.json({ posts });
}
