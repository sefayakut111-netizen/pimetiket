/**
 * GET /api/cron/archive-inactive
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * Vercel Cron her gece 03:00'te çalışır. 90 gün hareketsiz müşterileri R2'ye taşır.
 *
 * Schedule: vercel.json içindeki "crons" → "0 3 * * *"
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *   (Vercel Cron otomatik gönderir; manuel test için env'den oku)
 *
 * Response:
 *   {
 *     timestamp: string,
 *     candidatesFound: number,
 *     successfullyArchived: number,
 *     failed: number,
 *     totalBytesArchived: number,
 *     dryRun: boolean,
 *     details: ArchiveResult[]
 *   }
 *
 * GÜVENLİK:
 *   - Authorization header zorunlu
 *   - BATCH_SIZE: tek run'da max 10 müşteri (rate limit + Vercel timeout için)
 *   - DRY_RUN=true ise sadece raporlar, yazma yapmaz
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { archiveCustomer } from "@/lib/storage/archive-service";
import { IS_ARCHIVE_DRY_RUN } from "@/lib/storage/r2-client";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 dakika max (Vercel Pro plan limit)

const DAYS_INACTIVE = 90;
const BATCH_SIZE = 10;

export async function GET(req: NextRequest) {
  // Auth — Sefa 23 May v68 (P1.3): assertCronAuth (timing-safe).
  const guard = assertCronAuth(req);
  if (guard) return guard;

  try {
    const payload = await withCronRun("archive-inactive", async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Adayları çek
      const { data: candidates, error } = await supabase.rpc(
        "get_archive_candidates",
        { p_days_inactive: DAYS_INACTIVE }
      );

      if (error) {
        console.error("[cron:archive-inactive] candidates query failed:", error);
        throw new Error(error.message);
      }

      // İlk BATCH_SIZE'ı al
      const batch = (candidates ?? []).slice(0, BATCH_SIZE);

      const results = [];
      for (const candidate of batch) {
        const r = await archiveCustomer(
          candidate.user_id,
          `Otomatik: ${DAYS_INACTIVE} gün hareketsizlik`
        );
        results.push(r);
      }

      const summaryData = {
        timestamp: new Date().toISOString(),
        dryRun: IS_ARCHIVE_DRY_RUN,
        candidatesFound: candidates?.length ?? 0,
        batchProcessed: batch.length,
        successfullyArchived: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        totalBytesArchived: results.reduce((sum, r) => sum + r.totalBytes, 0),
        details: results,
      };

      console.log("[cron:archive-inactive]", JSON.stringify(summaryData, null, 2));

      return {
        summary: `${summaryData.successfullyArchived}/${batch.length} arşivlendi, ${summaryData.failed} hata`,
        itemsProcessed: batch.length,
        data: summaryData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/archive-inactive]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
