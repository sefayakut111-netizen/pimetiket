/**
 * GET /api/cron/seo-indexing
 *
 * Deploy sonrası veya haftalık: IndexNow (Bing/Yandex) + GSC API sitemap gönderimi.
 * Auth: CRON_SECRET
 */

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { submitGscSitemap } from "@/lib/seo/google-search-console";
import { submitIndexNowFromSitemap } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  try {
    const payload = await withCronRun("seo-indexing", async () => {
      const [indexNow, gsc] = await Promise.all([
        submitIndexNowFromSitemap(),
        submitGscSitemap(),
      ]);

      const ok = indexNow.ok || gsc.ok;
      return {
        summary: ok
          ? "IndexNow + GSC sitemap gönderildi"
          : "SEO indexing kısmen başarısız",
        itemsProcessed: (indexNow.urlCount ?? 0) + (gsc.ok ? 1 : 0),
        data: {
          ok,
          indexNow,
          gsc,
          ts: new Date().toISOString(),
        },
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/seo-indexing]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
