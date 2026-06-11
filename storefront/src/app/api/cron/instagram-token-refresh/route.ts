/**
 * GET /api/cron/instagram-token-refresh
 *
 * Haftalık long-lived Instagram token yenileme (60 gün ölümünü önler).
 * Schedule: Pazar 08:30 UTC (vercel.json)
 * Auth: CRON_SECRET
 */

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import {
  getInstagramToken,
  refreshInstagramAccessToken,
} from "@/lib/instagram/token";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  try {
    const payload = await withCronRun<Record<string, unknown>>(
      "instagram-token-refresh",
      async () => {
      const token = await getInstagramToken();
      if (!token) {
        return {
          summary: "Instagram token yok — refresh atlandı",
          itemsProcessed: 0,
          data: {
            ok: true,
            skipped: true,
            reason: "no_token",
            ts: new Date().toISOString(),
          },
        };
      }

      const result = await refreshInstagramAccessToken(token);
      const daysValid = Math.round(result.expiresIn / 86_400);

      return {
        summary: `Instagram token yenilendi — ~${daysValid} gün geçerli`,
        itemsProcessed: 1,
        data: {
          ok: true,
          refreshed: true,
          expiresAt: result.expiresAt,
          expiresIn: result.expiresIn,
          ts: new Date().toISOString(),
        },
      };
      }
    );

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/instagram-token-refresh]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
