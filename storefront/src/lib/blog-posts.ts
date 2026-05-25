/**
 * Blog yazıları — DB kaynağı (blog_posts tablosu).
 */

import { createClient } from "@/lib/supabase/server";
import { calculateReadMinutes } from "@/lib/blog-slug";

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  readMinutes: number;
  coverColor: string;
  coverImageUrl?: string | null;
  body: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

interface BlogPostRow {
  slug: string;
  title_tr: string;
  body_tr: string;
  excerpt_tr: string | null;
  category: string;
  author_name: string | null;
  published_at: string | null;
  read_minutes: number | null;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

const COVER_BY_CATEGORY: Record<string, string> = {
  rehber: "bg-krem",
  karsilastirma: "bg-pim-mercan-tint",
  teknoloji: "bg-yesil-soft",
  hakkimizda: "bg-krem-soft",
  pazarlama: "bg-pim-mercan-tint",
  trend: "bg-yesil-soft",
  teknik: "bg-gri-100",
  genel: "bg-krem",
};

function formatCategoryLabel(category: string): string {
  if (!category) return "Genel";
  return category.charAt(0).toLocaleUpperCase("tr-TR") + category.slice(1);
}

function rowToPost(row: BlogPostRow): BlogPost {
  const body = row.body_tr ?? "";
  const readMinutes = row.read_minutes ?? calculateReadMinutes(body);
  return {
    slug: row.slug,
    title: row.title_tr,
    excerpt: row.excerpt_tr ?? body.slice(0, 160),
    category: formatCategoryLabel(row.category),
    author: row.author_name ?? "Pim Etiket",
    publishedAt: row.published_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    readMinutes,
    coverColor: COVER_BY_CATEGORY[row.category.toLowerCase()] ?? "bg-krem",
    coverImageUrl: row.cover_image_url,
    body,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

export { calculateReadMinutes };

export function getReadMinutes(post: BlogPost): number {
  const calc = calculateReadMinutes(post.body);
  if (post.readMinutes > 0 && Math.abs(calc - post.readMinutes) / post.readMinutes > 0.3) {
    return calc;
  }
  return post.readMinutes;
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "slug, title_tr, body_tr, excerpt_tr, category, author_name, published_at, read_minutes, cover_image_url, seo_title, seo_description"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[blog-posts] getPublishedPosts:", error.message);
    return [];
  }

  return ((data ?? []) as BlogPostRow[]).map(rowToPost);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "slug, title_tr, body_tr, excerpt_tr, category, author_name, published_at, read_minutes, cover_image_url, seo_title, seo_description"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return rowToPost(data as BlogPostRow);
}

/** @deprecated getPublishedPosts kullan */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return getPostBySlug(slug);
}
