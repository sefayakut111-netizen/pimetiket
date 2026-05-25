import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog-posts";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface RouteEntry {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

const PUBLIC_ROUTES: RouteEntry[] = [
  // Ana
  { path: "", changeFrequency: "weekly", priority: 1.0 },
  { path: "/etiket", changeFrequency: "weekly", priority: 0.9 },
  { path: "/sticker", changeFrequency: "weekly", priority: 0.9 },

  // SEO + içerik
  { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
  { path: "/galeri", changeFrequency: "monthly", priority: 0.7 },
  { path: "/malzemeler", changeFrequency: "monthly", priority: 0.8 },
  { path: "/yorumlar", changeFrequency: "weekly", priority: 0.7 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.7 },
  { path: "/sss", changeFrequency: "monthly", priority: 0.7 },
  { path: "/sablonlar", changeFrequency: "weekly", priority: 0.8 },
  { path: "/iletisim", changeFrequency: "monthly", priority: 0.6 },

  // Yasal
  { path: "/kvkk", changeFrequency: "yearly", priority: 0.3 },
  { path: "/gizlilik", changeFrequency: "yearly", priority: 0.3 },
  { path: "/sartlar", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cerez", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mesafeli-satis", changeFrequency: "yearly", priority: 0.3 },
  { path: "/on-bilgilendirme", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cayma-hakki", changeFrequency: "yearly", priority: 0.3 },
  { path: "/iade-degisim-politikasi", changeFrequency: "yearly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticEntries = PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));

  const posts = await getPublishedPosts();
  const blogEntries = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
