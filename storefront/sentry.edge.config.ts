/**
 * Sentry — Edge runtime init (middleware, edge routes).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NODE_ENV,
  });
}
