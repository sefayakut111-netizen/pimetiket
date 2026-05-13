/**
 * Sentry — Client-side init (browser).
 *
 * @sentry/nextjs v10+ pattern: `src/instrumentation-client.ts` Next.js
 * tarafından otomatik bundle'a dahil edilir, client-side runtime'da
 * (browser'da) çalışır. Eski `sentry.client.config.ts` v10'da ARTIK
 * OKUNMUYOR — bu yüzden setTimeout'tan fırlatılan error Sentry'ye
 * ulaşmıyordu (Sefa raporu 12 May).
 *
 * Server + edge için ayrı: `src/instrumentation.ts` register() hook'u.
 *
 * DSN env: NEXT_PUBLIC_SENTRY_DSN (Vercel'de tanımlı).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Trace sample rate — production %10, dev %100
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay (session kayıt) — sadece hata anında, normal oturumda %0
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Release tag (Vercel git SHA, server config ile aynı release)
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NODE_ENV,
    // Hata yakalama filtreleri
    beforeSend(event) {
      if (event.request?.url?.includes("localhost")) return null;
      return event;
    },
    // Yaygın gürültü
    ignoreErrors: [
      "top.GLOBALS",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "NetworkError",
      "Failed to fetch",
      "Load failed",
      "ChunkLoadError",
    ],
    // Sentry v10 default integrations Browser tracing + Replay'i otomatik aktive eder.
    // beforeBreadcrumb ile PII redaksiyonu gerekirse buraya eklenir.
  });
}

// Router transition tracking (Sentry v10 önerilen pattern)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
