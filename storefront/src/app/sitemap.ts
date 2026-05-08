import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface RouteEntry {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

const PUBLIC_ROUTES: RouteEntry[] = [
  { path: "", changeFrequency: "weekly", priority: 1.0 },
  { path: "/etiket", changeFrequency: "weekly", priority: 0.9 },
  { path: "/sticker", changeFrequency: "weekly", priority: 0.9 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.7 },
  { path: "/sss", changeFrequency: "monthly", priority: 0.7 },
  { path: "/iletisim", changeFrequency: "monthly", priority: 0.6 },
  { path: "/kvkk", changeFrequency: "yearly", priority: 0.3 },
  { path: "/gizlilik", changeFrequency: "yearly", priority: 0.3 },
  { path: "/sartlar", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cerez", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mesafeli-satis", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cayma-hakki", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
