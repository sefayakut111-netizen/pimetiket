import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * robots.txt — Sefa 18 May v68 (koruma):
 *
 * Strateji:
 * - Meşru arama motorları (Google, Bing) sitemap'i indeksleyebilir
 * - Agresif AI scraper'lar (GPTBot, Anthropic-AI, CCBot) BLOK
 * - Generic crawler'lar için kullanıcı/private route'lar kapalı
 *
 * NOT: robots.txt sadece "iyi niyetli" bot'ları durdurur. Kötü niyetli
 * scraper'lar yine de gelir — Cloudflare WAF + rate limit (Seviye B)
 * tarafından engellenir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ----------------------------------------------------------------
      // Generic crawlers (Google, Bing, vb.) — public sayfalar açık,
      // kullanıcı ve admin route'ları kapalı
      // ----------------------------------------------------------------
      {
        userAgent: "*",
        allow: "/",
        disallow: [
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
        ],
      },
      // ----------------------------------------------------------------
      // AI scraper'lar — Pim Etiket içeriği AI training data olarak
      // KULLANILMASIN. KVKK aydınlatma metnimizde "üçüncü tarafa veri
      // satışı YOK" diyoruz, AI scraping bu ilkeye aykırı.
      // ----------------------------------------------------------------
      {
        userAgent: "GPTBot", // OpenAI
        disallow: "/",
      },
      {
        userAgent: "ChatGPT-User", // OpenAI ChatGPT browsing
        disallow: "/",
      },
      {
        userAgent: "OAI-SearchBot", // OpenAI search
        disallow: "/",
      },
      {
        userAgent: "anthropic-ai", // Anthropic Claude
        disallow: "/",
      },
      {
        userAgent: "ClaudeBot", // Anthropic crawler
        disallow: "/",
      },
      {
        userAgent: "Claude-Web", // Anthropic web access
        disallow: "/",
      },
      {
        userAgent: "Google-Extended", // Google Bard / Gemini training
        disallow: "/",
      },
      {
        userAgent: "CCBot", // Common Crawl (LLM training)
        disallow: "/",
      },
      {
        userAgent: "FacebookBot", // Meta AI
        disallow: "/",
      },
      {
        userAgent: "Bytespider", // ByteDance / TikTok
        disallow: "/",
      },
      {
        userAgent: "PerplexityBot", // Perplexity AI
        disallow: "/",
      },
      {
        userAgent: "Applebot-Extended", // Apple Intelligence training
        disallow: "/",
      },
      {
        userAgent: "Diffbot", // Generic AI scraper
        disallow: "/",
      },
      {
        userAgent: "ImagesiftBot", // Stock image scraper
        disallow: "/",
      },
      // ----------------------------------------------------------------
      // Agresif SEO / scraping bot'lar — yarış için site verisi alıyorlar
      // ----------------------------------------------------------------
      {
        userAgent: "AhrefsBot",
        disallow: "/",
      },
      {
        userAgent: "SemrushBot",
        disallow: "/",
      },
      {
        userAgent: "MJ12bot",
        disallow: "/",
      },
      {
        userAgent: "DotBot",
        disallow: "/",
      },
      {
        userAgent: "SeznamBot",
        disallow: "/",
      },
      {
        userAgent: "PetalBot",
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
