/**
 * Sentry — Client-side init (browser tarafı).
 *
 * Production hata avı için. DSN yoksa init no-op (dev safe).
 * Sefa Sentry hesabı açtıktan sonra:
 *   1. https://sentry.io → New Project → Next.js
 *   2. DSN'i kopyala
 *   3. Vercel env'e NEXT_PUBLIC_SENTRY_DSN olarak ekle
 *   4. Production deploy sonrası otomatik aktive
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Trace sample rate — production'da %10, dev'de %100
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay (oturum kaydı) — sadece hata olduğunda
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Release tag (Vercel git SHA)
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NODE_ENV,
    // Hata yakalama filtreleri
    beforeSend(event) {
      // Localhost / dev hatalarını gönderme
      if (event.request?.url?.includes("localhost")) return null;
      return event;
    },
    // Yaygın hata gürültüsü filtrele
    ignoreErrors: [
      // Browser eklentileri kaynaklı
      "top.GLOBALS",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network kaynaklı (kullanıcı offline)
      "NetworkError",
      "Failed to fetch",
      "Load failed",
      // Bilinen Next.js dev/HMR
      "ChunkLoadError",
    ],
  });
}
