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
import { IS_DRY_RUN } from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 dakika max (Vercel Pro plan limit)

const DAYS_INACTIVE = 90;
const BATCH_SIZE = 10;

export async function GET(req: NextRequest) {
  // Auth kontrolü
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase env eksik" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: "Query failed", details: error.message },
      { status: 500 }
    );
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

  const summary = {
    timestamp: new Date().toISOString(),
    dryRun: IS_DRY_RUN,
    candidatesFound: candidates?.length ?? 0,
    batchProcessed: batch.length,
    successfullyArchived: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    totalBytesArchived: results.reduce((sum, r) => sum + r.totalBytes, 0),
    details: results,
  };

  console.log("[cron:archive-inactive]", JSON.stringify(summary, null, 2));
  return NextResponse.json(summary);
}
