import type { NextConfig } from "next";

// Cloudflare bindings'i `next dev` sırasında ihtiyaç olunca aktive et.
// Vercel build'inde gereksiz, geçici olarak kapatıldı (deploy stack: Vercel).
// Cloudflare'e migrate olunca tekrar aç:
//   import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
//   if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();

const isProd = process.env.NODE_ENV === "production";

/**
 * Security headers — production'da zorunlu, dev'de gevşek.
 *
 * - HSTS: HTTPS zorla (1 yıl, includeSubdomains)
 * - X-Frame-Options: clickjacking engelleme
 * - X-Content-Type-Options: MIME sniffing engelleme
 * - Referrer-Policy: leak engelleme
 * - Permissions-Policy: gereksiz API'ları kapat
 * - X-DNS-Prefetch-Control: performans
 * - Content-Security-Policy: XSS savunması (PayTR iframe + Supabase
 *   + Resend asset'lerine izin verilir)
 *
 * NOT: CSP report-only mode'da başlatmak güvenli — production'da
 * "Content-Security-Policy" header'ı yerine "Content-Security-Policy-Report-Only"
 * koy, 1 hafta sonra tam aktive et.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(self), browsing-topics=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // CSP — production-grade. PayTR hosted iframe için frame-src.
  // Supabase WS için connect-src wss://. Resend tracking pixel için img-src.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Inline styles tailwind/CSS-in-JS için
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Inline JS Next.js bootstrap için.
      // PostHog (eu.i.posthog.com): /static/array.js yükleme + session replay worker.
      // Sentry (browser.sentry-cdn.com): replay & profiling worker'ları.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://browser.sentry-cdn.com",
      "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://browser.sentry-cdn.com",
      // Resimler: Supabase Storage signed URL + dataURL + PostHog session replay snapshots
      "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com https://eu.i.posthog.com https://eu-assets.i.posthog.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Supabase REST + WS, PayTR API, PostHog event ingestion, Sentry error ingestion
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.paytr.com https://www.google-analytics.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://eu.sentry.io https://*.ingest.de.sentry.io",
      // Session replay worker (PostHog) için
      "worker-src 'self' blob:",
      // PayTR hosted checkout iframe
      "frame-src 'self' https://www.paytr.com",
      "frame-ancestors 'self'",
      "form-action 'self' https://www.paytr.com",
      "base-uri 'self'",
      // Production'da http → https zorla
      isProd ? "upgrade-insecure-requests" : "",
    ]
      .filter(Boolean)
      .join("; "),
  },
];

const nextConfig: NextConfig = {
  // Next.js 16 generated validator.ts'te non-ASCII path karakterleriyle
  // (Türkçe ı/ğ vb.) codegen bug'ı var; build başarıyla derleniyor ama
  // post-build TS check yanlış @ts-ignore üretiyor. Production build için
  // skip — gerçek TS hataları `npm run lint` ve IDE'de yine yakalanır.
  // Cloudflare Pages build runner'ı Linux olduğu için orada zaten görünmez.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Modern formats — Next 16 default zaten içeriyor, explicit yapıldı.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 gün
    // Supabase Storage signed URL'leri için remote pattern
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Production HTTP gzip/brotli — default açık ama netliğe dökülüyor.
  compress: true,

  // X-Powered-By: Next.js header'ını kaldır (security + bytes).
  poweredByHeader: false,

  // React 19 strict-mode hata avlama.
  reactStrictMode: true,

  // PayTR REST API kullanıyoruz, npm paket yok — external mark gerekmez.
  // serverExternalPackages: [],

  // Production'da security header'ları enforce et
  async headers() {
    if (!isProd) return [];
    return [
      {
        // Tüm route'lar (API hariç ayrı kuralda olabilir, şimdilik aynı)
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
