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
import {
  queryYurticiShipment,
  IS_YURTICI_DRY_RUN,
  getYurticiConfig,
} from "@/lib/shipping/yurtici-api";

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
  // Bearer auth
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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
    return NextResponse.json(
      { error: rpcErr.message, stage: "rpc_candidates" },
      { status: 500 }
    );
  }

  const rows = (candidates ?? []) as CandidateRow[];
  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Poll adayı yok",
      yurticiConfig: config,
      durationMs: Date.now() - startedAt,
    });
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

    // Yeni event'leri upsert (idempotent unique constraint sayesinde dup atmaz)
    let newEvents = 0;
    if (apiResult.success && apiResult.events.length > 0) {
      for (const ev of apiResult.events) {
        const { error: upErr } = await supabase
          .from("shipment_status_events")
          .upsert(
            {
              order_id: row.order_id,
              assignment_id: row.assignment_id,
              status: ev.status,
              raw_status_code: ev.rawStatusCode,
              description: ev.description,
              location: ev.location,
              event_time: ev.eventTime.toISOString(),
              polled_at: new Date().toISOString(),
              raw_payload: {},
            },
            {
              onConflict: "order_id,status,event_time",
              ignoreDuplicates: true,
            }
          );
        if (!upErr) newEvents++;
      }

      // order_assignments güncelle
      await supabase
        .from("order_assignments")
        .update({
          tracking_status: apiResult.currentStatus,
          tracking_last_polled_at: new Date().toISOString(),
          tracking_delivered_at: apiResult.deliveredAt?.toISOString() ?? null,
        })
        .eq("id", row.assignment_id);
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

  return NextResponse.json({
    success: true,
    summary,
    yurticiConfig: config,
    results: results.slice(0, 20), // İlk 20 (log spam'i önle)
  });
}
