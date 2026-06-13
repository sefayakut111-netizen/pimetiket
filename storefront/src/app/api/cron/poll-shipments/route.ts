/**
 * GET /api/cron/poll-shipments
 *
 * Sefa 18 May v68:
 * Yurtiçi Kargo'dan kargo durum güncellemelerini otomatik çeker.
 * Her 4 saatte bir Vercel cron tarafından tetiklenir.
 *
 * Akış:
 *   1. fn_get_shipment_poll_candidates(240, 50) RPC ile aday listesi al
 *      (tracking_number'ı olan + delivered olmayan + son 4 saatte poll edilmemiş)
 *   2. Her aday için queryYurticiShipment() çağır
 *   3. Yeni event'leri shipment_status_events'e upsert (idempotent)
 *   4. order_assignments'a current_status + last_polled_at güncelle
 *   5. Delivered olunca tracking_delivered_at set + sonraki poll listesinden düşer
 *
 * Auth: Bearer ${CRON_SECRET}
 * Runtime: nodejs, maxDuration 300s (50 candidate × ~3-5s SOAP = ~250s)
 * DRY_RUN: YURTICI_DRY_RUN=true ise sahte event'ler basar (production env yokken safe)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import {
  queryYurticiShipment,
  IS_YURTICI_DRY_RUN,
  getYurticiConfig,
} from "@/lib/shipping/yurtici-api";
import { persistShipmentPoll } from "@/lib/shipping/persist-shipment-poll";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_LIMIT = 50;
const MIN_AGE_MINUTES = 240; // 4 saat

interface CandidateRow {
  assignment_id: string;
  order_id: string;
  tracking_number: string;
  tracking_company: string;
  shipped_at: string;
  last_polled_at: string | null;
}

export async function GET(req: NextRequest) {
  // Auth — Sefa 23 May v68 (P1.3): assertCronAuth (timing-safe).
  const guard = assertCronAuth(req);
  if (guard) return guard;

  try {
    const payload = await withCronRun<Record<string, unknown>>("poll-shipments", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const supabase = createServiceClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const startedAt = Date.now();
      const config = getYurticiConfig();

      // Aday listesi
      const { data: candidates, error: rpcErr } = await supabase.rpc(
        "fn_get_shipment_poll_candidates",
        {
          p_min_age_minutes: MIN_AGE_MINUTES,
          p_limit: BATCH_LIMIT,
        }
      );

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      const rows = (candidates ?? []) as CandidateRow[];
      if (rows.length === 0) {
        const responseData = {
          success: true,
          message: "Poll adayı yok",
          yurticiConfig: config,
          durationMs: Date.now() - startedAt,
        };
        return {
          summary: "Poll adayı yok",
          itemsProcessed: 0,
          data: responseData,
        };
      }

  type PollSummary = {
    orderId: string;
    trackingNumber: string;
    success: boolean;
    newEvents: number;
    currentStatus: string | null;
    delivered: boolean;
    error?: string;
  };

  const results: PollSummary[] = [];

  for (const row of rows) {
    // Sadece yurtici carrier — diğer carrier'lar elle takip ediliyor (manuel)
    if (!row.tracking_company?.toLowerCase().includes("yurtiçi") &&
        !row.tracking_company?.toLowerCase().includes("yurtici")) {
      continue;
    }

    const apiResult = await queryYurticiShipment(row.tracking_number);

    let newEvents = 0;
    if (apiResult.success) {
      const persisted = await persistShipmentPoll(supabase, {
        assignmentId: row.assignment_id,
        orderId: row.order_id,
        trackingNumber: row.tracking_number,
        apiResult,
        sendMail: true,
      });
      newEvents = persisted.newEvents;
    } else {
      // Poll fail olsa bile last_polled_at güncelle (rate limit için)
      await supabase
        .from("order_assignments")
        .update({ tracking_last_polled_at: new Date().toISOString() })
        .eq("id", row.assignment_id);
    }

    results.push({
      orderId: row.order_id,
      trackingNumber: row.tracking_number,
      success: apiResult.success,
      newEvents,
      currentStatus: apiResult.currentStatus,
      delivered: apiResult.deliveredAt !== null,
      error: apiResult.error,
    });
  }

      const summary = {
        totalCandidates: rows.length,
        polled: results.length,
        successful: results.filter((r) => r.success).length,
        delivered: results.filter((r) => r.delivered).length,
        totalNewEvents: results.reduce((s, r) => s + r.newEvents, 0),
        failed: results.filter((r) => !r.success).length,
        durationMs: Date.now() - startedAt,
        dryRun: IS_YURTICI_DRY_RUN,
      };

      const responseData = {
        success: true,
        summary,
        yurticiConfig: config,
        results: results.slice(0, 20), // İlk 20 (log spam'i önle)
      };

      return {
        summary: `${results.length} kargo poll edildi, ${summary.delivered} teslim`,
        itemsProcessed: results.length,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/poll-shipments]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
