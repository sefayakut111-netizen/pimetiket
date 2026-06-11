/**
 * GET /api/cron/instagram-sync
 *
 * Ana sayfa Instagram feed slotlarını günceller.
 * Schedule: vercel.json → 0 7 * * * (günlük 07:00 UTC / 10:00 TR)
 * Auth: CRON_SECRET
 */
import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { syncInstagramToSiteImageSlots } from "@/lib/instagram/sync-slots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  try {
    const payload = await withCronRun("instagram-sync", async () => {
      const result = await syncInstagramToSiteImageSlots(6);
      const summary =
        result.reason === "missing_token"
          ? "INSTAGRAM_ACCESS_TOKEN eksik — sync atlandı"
          : result.ok
            ? `Instagram sync: ${result.synced} slot güncellendi`
            : `Instagram sync başarısız (${result.reason ?? "unknown"})`;

      return {
        summary,
        itemsProcessed: result.synced,
        data: { ...result, ts: new Date().toISOString() },
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/instagram-sync]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
