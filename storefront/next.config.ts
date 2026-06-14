import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
      // Sefa 23 May v68: POC iframe (/poc.html) bicak editor 4 CDN'den script
      // cekiyor — OpenCV.js (docs.opencv.org), PDF.js (cdnjs.cloudflare.com),
      // ag-psd PSD parser (cdn.jsdelivr.net), @imgly/background-removal
      // (esm.run). CSP block'lanirsa POC'da "Bir gorsel yukle" bos kaliyor.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://browser.sentry-cdn.com https://docs.opencv.org https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://esm.run https://cdn.skypack.dev",
      "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://browser.sentry-cdn.com https://docs.opencv.org https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://esm.run https://cdn.skypack.dev",
      // Resimler: Supabase Storage signed URL + dataURL + PostHog session replay snapshots
      // Sefa 14 Haz: Instagram anasayfa feed — IG medya görselleri *.cdninstagram.com'dan
      // doğrudan (unoptimized) yükleniyor; CSP allowlist'e eklenmezse kartlar boş kalır.
      "img-src 'self' data: blob: https://*.supabase.co https://*.cdninstagram.com https://www.google-analytics.com https://eu.i.posthog.com https://eu-assets.i.posthog.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Supabase REST + WS, PayTR API, PostHog event ingestion, Sentry error ingestion
      // Sefa 23 May v68: POC iframe WASM/asset fetch'i — OpenCV.wasm,
      // background-removal model dosyalari (esm.run -> jsdelivr CDN).
      // `data:` — OpenCV.js runtime icinde WASM binary'sini base64 data URL
      // olarak embed ediyor ve kendi kendine fetch ediyor (xhr.open data:...).
      // Bunu izin vermezsek opencv init asamasinda console hatasi atar.
      "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://www.paytr.com https://www.google-analytics.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://eu.sentry.io https://*.ingest.de.sentry.io https://docs.opencv.org https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://esm.run https://cdn.skypack.dev https://huggingface.co https://*.huggingface.co https://staticimgly.com",
      // Session replay worker (PostHog) + POC PDF.js worker (cdnjs)
      "worker-src 'self' blob: https://cdnjs.cloudflare.com",
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
  // Vercel git SHA → client Sentry release tag (instrumentation-client.ts)
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "",
  },

  typescript: {
    ignoreBuildErrors: false,
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
      {
        protocol: "https",
        hostname: "*.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "scontent.cdninstagram.com",
      },
    ],
  },

  // Production HTTP gzip/brotli — default açık ama netliğe dökülüyor.
  compress: true,

  // X-Powered-By: Next.js header'ını kaldır (security + bytes).
  poweredByHeader: false,

  // React 19 strict-mode hata avlama.
  reactStrictMode: true,

  // Mobile LCP: above-the-fold CSS inline (Critters) — render-blocking azaltma.
  experimental: {
    optimizeCss: true,
  },

  // Sefa 18 May v68 (koruma): Source map'ler production'da tarayıcıya
  // SERVE EDİLMEZ — sadece Sentry'ye upload olur (debug için).
  // Bu, prod kodun okunmasını ciddi şekilde zorlaştırır (minified bundle
  // kalır, ama original source map yok). Sentry hideSourceMaps zaten true.
  productionBrowserSourceMaps: false,

  // PayTR REST API kullanıyoruz, npm paket yok — external mark gerekmez.
  // serverExternalPackages: [],

  // Production'da security header'ları enforce et
  async headers() {
    const staticCache = [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];

    if (!isProd) return staticCache;

    return [
      ...staticCache,
      {
        // Tüm route'lar (API hariç ayrı kuralda olabilir, şimdilik aynı)
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Sefa 18 May v68 (admin denetim 1.2): eski/test yasal URL'leri
  // güncel sayfalara redirect — 404 göstermesin
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pimetiket.com" }],
        destination: "https://pimetiket.com/:path*",
        permanent: true,
      },
      {
        source: "/iade-cayma",
        destination: "/iade-degisim-politikasi",
        permanent: true,
      },
      // Sefa 21 May v68 (UX denetim P2 #10): /cayma-hakki redirect kaldırıldı.
      // Cayma hakkı ayrı bir hukuki kavram (TKHK m.15) ve src/app/cayma-hakki/
      // page.tsx zaten var — başlık + içerik tam. SEO + hukuki şeffaflık.
    ];
  },
};

// ============================================================
// Sentry — source map upload + release tracking
//
// SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT env'leri Vercel'de
// tanımlı olduğunda her production build'de source map otomatik upload
// edilir. Token yoksa silent skip — build break etmez.
// ============================================================
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Token yoksa silent — dev/local'de build break etmesin
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Source map'leri Sentry'ye yükle, prod bundle'da bırakma (boyut tasarrufu)
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  // Telemetry kapalı — Sefa kararı, privacy
  telemetry: false,
  // Ad-blocker bypass — Sentry event'leri same-origin tunnel üzerinden gider
  tunnelRoute: "/monitoring",
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
