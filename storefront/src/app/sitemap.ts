import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog-posts";
import { MATERIAL_SLUGS } from "@/lib/seo/materials";
import { ETIKET_TYPE_SLUGS, STICKER_TYPE_SLUGS } from "@/lib/seo/type-landings";
import { getSiteUrl } from "@/lib/site-url";

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
  { path: "/galeri", changeFrequency: "weekly", priority: 0.7 },
  { path: "/malzemeler", changeFrequency: "monthly", priority: 0.8 },
  { path: "/yorumlar", changeFrequency: "weekly", priority: 0.7 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nasil-uretiyoruz", changeFrequency: "monthly", priority: 0.7 },
  { path: "/sss", changeFrequency: "monthly", priority: 0.7 },
  { path: "/terim-sozlugu", changeFrequency: "monthly", priority: 0.6 },
  { path: "/sablonlar", changeFrequency: "weekly", priority: 0.8 },
  { path: "/iletisim", changeFrequency: "monthly", priority: 0.6 },
  { path: "/firma-bilgileri", changeFrequency: "yearly", priority: 0.3 },

  // Yasal
  { path: "/kvkk", changeFrequency: "yearly", priority: 0.3 },
  { path: "/gizlilik", changeFrequency: "yearly", priority: 0.3 },
  { path: "/sartlar", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cerez", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mesafeli-satis", changeFrequency: "yearly", priority: 0.3 },
  { path: "/on-bilgilendirme", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cayma-hakki", changeFrequency: "yearly", priority: 0.3 },
  { path: "/iade-degisim-politikasi", changeFrequency: "yearly", priority: 0.4 },
  { path: "/telif-sikayet", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = getSiteUrl();
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

  const materialEntries = MATERIAL_SLUGS.map((slug) => ({
    url: `${SITE_URL}/malzeme/${slug}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const typeLandingEntries = [
    ...ETIKET_TYPE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/etiket/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    ...STICKER_TYPE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/sticker/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];

  const blogTagSlugs = [
    ...new Set(posts.map((p) => p.categoryRaw).filter(Boolean)),
  ];
  const blogTagEntries = blogTagSlugs.map((tag) => ({
    url: `${SITE_URL}/blog/konu/${tag}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.55,
  }));

  return [
    ...staticEntries,
    ...materialEntries,
    ...typeLandingEntries,
    ...blogEntries,
    ...blogTagEntries,
  ];
}
