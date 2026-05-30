/**
 * GET /api/health — hafif uptime ping (auth yok).
 * Uptime monitor / Vercel health check için.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      version: sha ? sha.slice(0, 7) : "dev",
      sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      analytics: Boolean(
        process.env.NEXT_PUBLIC_POSTHOG_KEY ||
          process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
      ),
      googleSearchConsole: Boolean(
        process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
      ),
      ga4: Boolean(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()),
      posthog: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()),
      mail: Boolean(process.env.RESEND_API_KEY),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
