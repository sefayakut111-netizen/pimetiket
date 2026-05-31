/**
 * GET /api/cron/seo-indexing
 *
 * Deploy sonrası veya haftalık: IndexNow (Bing/Yandex) + GSC API sitemap gönderimi.
 * Auth: CRON_SECRET
 */

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { submitGscSitemap } from "@/lib/seo/google-search-console";
import { submitIndexNowFromSitemap } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  const [indexNow, gsc] = await Promise.all([
    submitIndexNowFromSitemap(),
    submitGscSitemap(),
  ]);

  return NextResponse.json({
    ok: indexNow.ok || gsc.ok,
    indexNow,
    gsc,
    ts: new Date().toISOString(),
  });
}
