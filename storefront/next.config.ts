import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modern formats — Next 16 default zaten içeriyor, explicit yapıldı.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 gün
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
};

export default nextConfig;
