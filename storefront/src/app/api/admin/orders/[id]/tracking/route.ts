/**
 * POST /api/admin/orders/[id]/tracking
 * GET  /api/admin/orders/[id]/tracking
 *
 * Sefa 18 May v68:
 * Admin manuel kargo bilgisi giriş + güncelleme + sorgu.
 *
 * POST body:
 *   {
 *     carrierCode: 'yurtici' (default),
 *     trackingNumber: '1234567890',
 *     trackingUrl?: string (opsiyonel, otomatik üretilir)
 *   }
 *
 * Davranış:
 *   - order_assignments'ta mevcut "shipped" satır varsa update eder.
 *   - Yoksa yeni assignment yaratır (fason flow olmadan da manuel kargolama).
 *   - status='shipped' set edilirse trg_notify_customer_shipped tetiklenir
 *     → mail_outbox'a "kargoya verildi" maili düşer (Migration 045).
 *   - İlk Yurtiçi API poll'u senkron çağrılır — kargo gerçekten yola çıktı
 *     mı doğrulanır + ilk timeline event'i oluşur.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { queryYurticiShipment } from "@/lib/shipping/yurtici-api";
import { findCarrier, getTrackingUrl } from "@/lib/shipping/carriers";

export const runtime = "nodejs";
export const maxDuration = 30;

function makeServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ============================================================
// GET — mevcut tracking durumunu getir
// ============================================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: orderId } = await params;
  const supabase = makeServiceClient();

  const { data: assignments } = await supabase
    .from("order_assignments")
    .select(
      "id, tracking_company, tracking_number, tracking_url, tracking_status, tracking_last_polled_at, tracking_delivered_at, shipped_at, status"
    )
    .eq("order_id", orderId)
    .order("assigned_at", { ascending: false })
    .limit(1);

  const a = (assignments?.[0] ?? null) as
    | {
        id: string;
        tracking_company: string | null;
        tracking_number: string | null;
        tracking_url: string | null;
        tracking_status: string | null;
        tracking_last_polled_at: string | null;
        tracking_delivered_at: string | null;
        shipped_at: string | null;
        status: string;
      }
    | null;

  const { data: events } = await supabase
    .from("shipment_status_events")
    .select("status, description, location, event_time")
    .eq("order_id", orderId)
    .order("event_time", { ascending: true });

  return NextResponse.json({
    assignment: a,
    events: events ?? [],
  });
}

// ============================================================
// POST — admin manuel tracking ekle/güncelle
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const trackingNumber = (body.trackingNumber as string | undefined)?.trim();
  const carrierCode =
    (body.carrierCode as string | undefined)?.trim() ?? "yurtici";
  let trackingUrl = (body.trackingUrl as string | undefined)?.trim();

  if (!trackingNumber) {
    return NextResponse.json(
      { error: "trackingNumber zorunlu" },
      { status: 400 }
    );
  }

  if (trackingNumber.length < 6 || trackingNumber.length > 64) {
    return NextResponse.json(
      { error: "Takip numarası 6-64 karakter olmalı" },
      { status: 400 }
    );
  }

  const carrier = findCarrier(carrierCode);
  if (!trackingUrl) {
    trackingUrl = getTrackingUrl(carrier.code, trackingNumber) ?? undefined;
  }

  const supabase = makeServiceClient();

  // Order var mı?
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) {
    return NextResponse.json(
      { error: "Sipariş bulunamadı" },
      { status: 404 }
    );
  }

  // Mevcut assignment var mı?
  const { data: existing } = await supabase
    .from("order_assignments")
    .select("id, status")
    .eq("order_id", orderId)
    .order("assigned_at", { ascending: false })
    .limit(1);

  let assignmentId: string;
  if (existing && existing.length > 0) {
    // Update
    assignmentId = (existing[0] as { id: string }).id;
    const { error: updErr } = await supabase
      .from("order_assignments")
      .update({
        tracking_company: carrier.displayName,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl ?? null,
        status: "shipped",
        shipped_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    // Insert (manuel kargolama — fason flow yok)
    const { data: ins, error: insErr } = await supabase
      .from("order_assignments")
      .insert({
        order_id: orderId,
        status: "shipped",
        tracking_company: carrier.displayName,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl ?? null,
        shipped_at: new Date().toISOString(),
        // fason_id NULL — manuel kargolama
      })
      .select("id")
      .single();
    if (insErr || !ins) {
      return NextResponse.json(
        { error: insErr?.message ?? "Insert hatası" },
        { status: 500 }
      );
    }
    assignmentId = (ins as { id: string }).id;
  }

  // İlk Yurtiçi poll'u senkron — kargo var mı, yola çıkmış mı doğrula
  const apiResult = await queryYurticiShipment(trackingNumber);

  if (apiResult.success && apiResult.events.length > 0) {
    // shipment_status_events'e idempotent insert
    for (const ev of apiResult.events) {
      await supabase
        .from("shipment_status_events")
        .upsert(
          {
            order_id: orderId,
            assignment_id: assignmentId,
            status: ev.status,
            raw_status_code: ev.rawStatusCode,
            description: ev.description,
            location: ev.location,
            event_time: ev.eventTime.toISOString(),
            polled_at: new Date().toISOString(),
            raw_payload: {},
          },
          { onConflict: "order_id,status,event_time" }
        );
    }

    // order_assignments'ı güncelle
    await supabase
      .from("order_assignments")
      .update({
        tracking_status: apiResult.currentStatus,
        tracking_last_polled_at: new Date().toISOString(),
        tracking_delivered_at: apiResult.deliveredAt?.toISOString() ?? null,
      })
      .eq("id", assignmentId);
  }

  // Order events log
  await supabase.from("order_events").insert({
    order_id: orderId,
    kind: "shipping_tracking_added",
    actor_user_id: auth.user.id,
    actor_role: auth.role,
    metadata: {
      carrier_code: carrier.code,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      yurtici_poll_success: apiResult.success,
      yurtici_dry_run: apiResult.dryRun,
    },
  });

  return NextResponse.json({
    success: true,
    assignmentId,
    yurticiPoll: {
      success: apiResult.success,
      currentStatus: apiResult.currentStatus,
      eventCount: apiResult.events.length,
      dryRun: apiResult.dryRun,
      error: apiResult.error,
    },
  });
}
