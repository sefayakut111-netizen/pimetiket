/**
 * POST /api/admin/fason/assign
 *
 * Sefa "Fason'a gönder" butonuna basınca çağrılır.
 *
 * Atomik işlem:
 *   1. order_assignments INSERT (status=assigned)
 *   2. fason_access_token üret (form için)
 *   3. fason_mail_outbox INSERT (Resend gelince gönderilecek)
 *   4. order_events 'fason_assigned' log
 *   5. orders.status → 'in_production' (artık üretimde sayılır)
 *
 * Body: { orderId, fasonPartnerId, estimatedDelivery, notes? }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

interface BodyShape {
  orderId?: unknown;
  fasonPartnerId?: unknown;
  estimatedDelivery?: unknown;
  notes?: unknown;
}

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const fasonPartnerId =
    typeof body.fasonPartnerId === "string" ? body.fasonPartnerId.trim() : "";
  const estimatedDelivery =
    typeof body.estimatedDelivery === "string" ? body.estimatedDelivery : null;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 1000) : null;

  if (!orderId || !fasonPartnerId) {
    return NextResponse.json(
      { error: "orderId ve fasonPartnerId zorunlu" },
      { status: 400 }
    );
  }

  // Auth — admin/staff
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Order var mı + status uygun mu
  const { data: orderData, error: orderErr } = await admin
    .from("orders")
    .select("id, status, user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !orderData) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  const order = orderData as { id: string; status: string; user_id: string | null };

  // 2) Fason var mı + active + contract signed
  const { data: fasonData, error: fasonErr } = await admin
    .from("fason_partners")
    .select("id, name, active, contract_signed_at, contact_email")
    .eq("id", fasonPartnerId)
    .maybeSingle();
  if (fasonErr || !fasonData) {
    return NextResponse.json({ error: "Fason bulunamadı" }, { status: 404 });
  }
  const fason = fasonData as {
    id: string;
    name: string;
    active: boolean;
    contract_signed_at: string | null;
    contact_email: string;
  };
  if (!fason.active) {
    return NextResponse.json({ error: "Fason aktif değil" }, { status: 400 });
  }
  if (!fason.contract_signed_at) {
    return NextResponse.json(
      {
        error:
          "Bu fason için veri işleyici sözleşmesi imzalanmamış. Sözleşme olmadan atama yapılamaz (KVKK m.12).",
      },
      { status: 400 }
    );
  }

  // 3) order_assignments INSERT
  const { data: assignment, error: assignErr } = await admin
    .from("order_assignments")
    .insert({
      order_id: orderId,
      fason_partner_id: fasonPartnerId,
      status: "assigned",
      assigned_by: user.id,
      estimated_delivery: estimatedDelivery,
      notes,
    })
    .select("id")
    .single();
  if (assignErr || !assignment) {
    console.error("[fason/assign] insert error:", assignErr);
    return NextResponse.json(
      {
        error:
          assignErr?.code === "23505"
            ? "Bu sipariş zaten bir fasona atanmış"
            : "Atama oluşturulamadı",
      },
      { status: 500 }
    );
  }
  const assignmentId = (assignment as { id: string }).id;

  // 4) fason_access_token üret (form için)
  const { data: tokenData } = await admin.rpc(
    "fn_generate_fason_token" as never,
    {
      p_assignment_id: assignmentId,
      p_fason_partner_id: fasonPartnerId,
      p_days: 14, // teslim + buffer
    } as never
  );
  const fasonToken = tokenData as string | null;

  // 5) Mail outbox'a koy (Resend gelince gönderilecek)
  await admin.from("fason_mail_outbox").insert({
    assignment_id: assignmentId,
    template_key: "fason_new_assignment",
    to_email: fason.contact_email,
    subject: `Yeni iş — Sipariş ${orderId} · teslim ${estimatedDelivery ?? "yakında"}`,
    payload: {
      order_id: orderId,
      fason_name: fason.name,
      estimated_delivery: estimatedDelivery,
      notes,
      fason_token: fasonToken,
    },
    status: "pending",
    next_retry_at: new Date().toISOString(),
  });

  // 6) order_events log
  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "fason_assigned",
    status_after: order.status,
    actor_id: user.id,
    actor_role: role,
    summary: `Fason atandı: ${fason.name}`,
    detail: {
      assignment_id: assignmentId,
      fason_id: fasonPartnerId,
      fason_name: fason.name,
      estimated_delivery: estimatedDelivery,
    },
  });

  // 7) Order status → in_production
  await admin
    .from("orders")
    .update({ status: "in_production" })
    .eq("id", orderId);

  return NextResponse.json({
    ok: true,
    assignmentId,
    fasonToken, // Sefa'nın admin'de görüp manuel paylaşabilmesi için
    fasonName: fason.name,
  });
}
