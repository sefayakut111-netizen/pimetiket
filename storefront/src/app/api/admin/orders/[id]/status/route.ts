/**
 * /api/admin/orders/[id]/status — admin status update + audit log.
 *
 * POST { status, note? }
 * - orders.status update
 * - order_events 'status_changed' insert (audit trail)
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

interface BodyShape {
  status?: unknown;
  note?: unknown;
}

const VALID_STATUSES = [
  "paid",
  "qc_pending",
  "qc_flagged",
  "operator_review",
  "proof_pending",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" && VALID_STATUSES.includes(body.status)
      ? body.status
      : null;
  if (!status) {
    return NextResponse.json({ error: "Geçersiz status" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  // Admin auth check
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Service role update
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mevcut status'u oku (audit için)
  const { data: existingData, error: existingErr } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (existingErr || !existingData) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  const existing = existingData as { id: string; status: string };
  if (existing.status === status) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // Update + log atomic değil ama tolerable (trigger'la atomic yapılabilir)
  const { error: updateErr } = await admin
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (updateErr) {
    console.error("[admin status] update error:", updateErr);
    return NextResponse.json({ error: "Güncelleme başarısız" }, { status: 500 });
  }

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "status_changed",
      status_after: status,
      actor_id: user.id,
      actor_role: role,
      summary: `Status: ${existing.status} → ${status}${note ? " · " + note : ""}`,
      detail: { from: existing.status, to: status, note },
    },
  ]);

  return NextResponse.json({
    ok: true,
    from: existing.status,
    to: status,
  });
}
