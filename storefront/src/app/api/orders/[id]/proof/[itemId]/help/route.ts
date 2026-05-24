/**
 * POST /api/orders/[id]/proof/[itemId]/help
 *
 * Sefa 19 May v68 (Migration 059):
 * POC'taki "Ekibimizden yardım iste" modal'ı operatör ticket'ı açar.
 *
 * Body: { message: string }   (1-1000 char)
 *
 * Akış:
 *   1. proof_help_requests INSERT (status='open')
 *   2. order_items.proof_status = 'help_requested'
 *   3. order_events log
 *   4. Operatör paneli (/admin/destek/proof) listede gösterir
 *
 * NOT: Açık help_request varken fn_finalize_proof fail döner; müşteri
 * tüm itemler approved olsa bile operatör çözümleyene dek bekler.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

interface Body {
  message?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
  if (messageRaw.length < 1 || messageRaw.length > 1000) {
    return NextResponse.json(
      { error: "Mesaj 1-1000 karakter arası olmalı" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Auth check + status
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (orderRow.status !== "proof_pending") {
    return NextResponse.json(
      { error: `Bu aşamada yardım talebi açılamaz (${orderRow.status})` },
      { status: 400 }
    );
  }

  // Item gerçekten bu siparişe mi ait?
  const { data: itemRow } = await admin
    .from("order_items")
    .select("id")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!itemRow) {
    return NextResponse.json(
      { error: "Sipariş kalemi bulunamadı" },
      { status: 404 }
    );
  }

  // INSERT help request
  const { data: hr, error: hrErr } = await admin
    .from("proof_help_requests")
    .insert({
      order_id: orderId,
      order_item_id: itemId,
      user_id: user.id,
      message: messageRaw,
      status: "open",
    } satisfies TablesInsert<"proof_help_requests">)
    .select("id")
    .single();
  if (hrErr) {
    console.error("[proof/help] insert error:", hrErr);
    return NextResponse.json(
      { error: "Yardım talebi oluşturulamadı" },
      { status: 500 }
    );
  }

  // Item status'a 'help_requested' set et
  await admin
    .from("order_items")
    .update({ proof_status: "help_requested" })
    .eq("id", itemId)
    .eq("order_id", orderId);

  // order_events log
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "proof_help_requested",
      status_after: orderRow.status as Enums<"order_status">,
      actor_id: user.id,
      actor_role: "customer",
      summary: `Müşteri operatör yardımı istedi: ${messageRaw.slice(0, 80)}...`,
      detail: {
        item_id: itemId,
        help_request_id: (hr as { id: string }).id,
        message: messageRaw,
      },
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({
    ok: true,
    helpRequestId: (hr as { id: string }).id,
  });
}
