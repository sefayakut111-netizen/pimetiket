import type { NextConfig } from "next";

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
 * - Content-Security-Policy: XSS savunması (iyzico iframe + Supabase
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
  // CSP — production-grade. iyzico hosted form için frame-src.
  // Supabase WS için connect-src wss://. Resend tracking pixel için img-src.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Inline styles tailwind/CSS-in-JS için
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Inline JS Next.js bootstrap için
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com",
      // Resimler: Supabase Storage signed URL + dataURL
      "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Supabase REST + WS, iyzico API
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.iyzipay.com https://sandbox-api.iyzipay.com https://www.google-analytics.com",
      // iyzico hosted checkout form
      "frame-src 'self' https://www.iyzipay.com https://sandbox-static.iyzipay.com",
      "frame-ancestors 'self'",
      "form-action 'self' https://www.iyzipay.com https://sandbox-static.iyzipay.com",
      "base-uri 'self'",
      // Production'da http → https zorla
      isProd ? "upgrade-insecure-requests" : "",
    ]
      .filter(Boolean)
      .join("; "),
  },
];

const nextConfig: NextConfig = {
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

  // iyzipay paketi `fs.readdirSync` ile resource'ları dinamik yüklüyor
  // (eski CommonJS pattern). Turbopack bunu derleyemiyor → external mark
  // edip runtime'da çözmesini sağla.
  serverExternalPackages: ["iyzipay"],

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
