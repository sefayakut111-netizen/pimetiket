/**
 * POST /api/admin/shipments/bulk-poll
 *
 * Sefa 18 May v68:
 * Toplu poll — admin checkbox ile seçtiği kargolar için manuel Yurtiçi
 * API sorgu. Cron beklemeden hemen güncellemek için.
 *
 * Request body:
 *   { assignmentIds: string[] }   (max 50)
 *
 * Akış:
 *   - Her assignment için tracking_number'ı al
 *   - queryYurticiShipment() çağır
 *   - shipment_status_events'e idempotent upsert
 *   - order_assignments'a current_status + last_polled_at güncelle
 *
 * Response:
 *   {
 *     summary: { polled, success, failed, newEvents },
 *     results: [{ assignmentId, success, currentStatus, newEvents, error? }, ...]
 *   }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { queryYurticiShipment } from "@/lib/shipping/yurtici-api";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BULK = 50;

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const assignmentIds = (body.assignmentIds as unknown[] | undefined) ?? [];

  if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
    return NextResponse.json(
      { error: "assignmentIds (array) zorunlu" },
      { status: 400 }
    );
  }

  if (assignmentIds.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Maks ${MAX_BULK} assignment toplu poll yapılabilir` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Assignment'ları al
  const { data: assignments, error: fetchErr } = await supabase
    .from("order_assignments")
    .select("id, order_id, tracking_number, tracking_company")
    .in("id", assignmentIds as string[])
    .not("tracking_number", "is", null);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  type Row = {
    id: string;
    order_id: string;
    tracking_number: string;
    tracking_company: string | null;
  };

  const rows = (assignments ?? []) as Row[];
  type Result = {
    assignmentId: string;
    orderId: string;
    success: boolean;
    currentStatus: string | null;
    newEvents: number;
    error?: string;
  };
  const results: Result[] = [];

  for (const row of rows) {
    const apiResult = await queryYurticiShipment(row.tracking_number);

    let newEvents = 0;
    if (apiResult.success && apiResult.events.length > 0) {
      for (const ev of apiResult.events) {
        const { error: upErr } = await supabase
          .from("shipment_status_events")
          .upsert(
            {
              order_id: row.order_id,
              assignment_id: row.id,
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

      await supabase
        .from("order_assignments")
        .update({
          tracking_status: apiResult.currentStatus,
          tracking_last_polled_at: new Date().toISOString(),
          tracking_delivered_at:
            apiResult.deliveredAt?.toISOString() ?? null,
        })
        .eq("id", row.id);
    } else {
      // Poll fail olsa bile last_polled güncelle
      await supabase
        .from("order_assignments")
        .update({ tracking_last_polled_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    results.push({
      assignmentId: row.id,
      orderId: row.order_id,
      success: apiResult.success,
      currentStatus: apiResult.currentStatus,
      newEvents,
      error: apiResult.error,
    });
  }

  const summary = {
    polled: results.length,
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    newEvents: results.reduce((s, r) => s + r.newEvents, 0),
  };

  return NextResponse.json({ summary, results });
}
