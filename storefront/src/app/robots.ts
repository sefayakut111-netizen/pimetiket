import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Kullanıcı / admin / ödeme yolları — tüm public crawler kurallarında paylaşılır */
const PRIVATE_DISALLOW = [
  "/admin/",
  "/panelim",
  "/profil",
  "/adreslerim",
  "/fatura-bilgileri",
  "/siparislerim",
  "/siparis/",
  "/sepet",
  "/odeme",
  "/odeme-sonuc",
  "/sifre-sifirla",
  "/auth",
  "/fason/",
  "/api/",
] as const;

/** AI arama / retrieval — public sayfalar açık, private kapalı */
const RETRIEVAL_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-Web",
  "Applebot",
] as const;

/** Eğitim / veri toplama — tam site kapalı */
const TRAINING_BOTS = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "Applebot-Extended",
  "Bytespider",
  "FacebookBot",
  "Diffbot",
  "ImagesiftBot",
] as const;

/** SEO scraper — tam site kapalı */
const SEO_SCRAPER_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "SeznamBot",
  "PetalBot",
] as const;

/**
 * robots.txt — retrieval botları açık (AI görünürlük), training botları kapalı (kontrol).
 *
 * - Meşru arama motorları (Google, Bing) + AI retrieval botları: public açık, private kapalı
 * - Eğitim botları (GPTBot, Google-Extended, CCBot): disallow /
 * - SEO scraper'lar: disallow /
 */
export default function robots(): MetadataRoute.Robots {
  const publicCrawlRule = {
    allow: "/" as const,
    disallow: [...PRIVATE_DISALLOW],
  };

  return {
    rules: [
      { userAgent: "*", ...publicCrawlRule },
      ...RETRIEVAL_BOTS.map((userAgent) => ({
        userAgent,
        ...publicCrawlRule,
      })),
      ...[...TRAINING_BOTS, ...SEO_SCRAPER_BOTS].map((userAgent) => ({
        userAgent,
        disallow: "/" as const,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
