/**
 * POST /api/admin/fason/assign
 *
 * Sefa "Fason'a gönder" butonuna basınca çağrılır.
 *
 * Migration 024 ile **atomik RPC** kullanıyor:
 *   fn_assign_order_to_fason → assignment + token + outbox + event + status
 *   tek transaction içinde. Hata durumunda PostgreSQL otomatik rollback.
 *
 * Endpoint sorumlulukları:
 *   - Auth (admin/staff)
 *   - RPC çağır
 *   - Hata kodlarını insan diline çevir
 *   - audit_log yaz (RPC dışında, asıl iş başarılıysa)
 *
 * Body: { orderId, fasonPartnerId, estimatedDelivery, notes? }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";

interface BodyShape {
  orderId?: unknown;
  fasonPartnerId?: unknown;
  estimatedDelivery?: unknown;
  notes?: unknown;
}

interface RpcRow {
  assignment_id: string;
  fason_token: string;
  order_status_before: string;
  order_status_after: string;
}

const HUMAN_ERRORS: Record<string, { msg: string; status: number }> = {
  order_not_found: { msg: "Sipariş bulunamadı", status: 404 },
  fason_not_found: { msg: "Fason bulunamadı", status: 404 },
  fason_inactive: { msg: "Fason aktif değil", status: 400 },
  fason_no_contract: {
    msg: "Bu fason için veri işleyici sözleşmesi imzalanmamış. Sözleşme olmadan atama yapılamaz (KVKK m.12).",
    status: 400,
  },
};

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
  const auth = await assertPermission("fason", "update");
  if (!auth) {
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

  // Atomik RPC — Migration 024
  const { data, error } = await admin.rpc(
    "fn_assign_order_to_fason" as never,
    {
      p_order_id: orderId,
      p_fason_partner_id: fasonPartnerId,
      p_admin_user_id: auth.user.id,
      p_estimated_delivery: estimatedDelivery,
      p_notes: notes,
      p_token_days: 14,
    } as never
  );

  if (error) {
    // PostgreSQL exception mesajı içinde sentinel string ara
    const msg = error.message ?? "";
    for (const [key, meta] of Object.entries(HUMAN_ERRORS)) {
      if (msg.includes(key)) {
        return NextResponse.json({ error: meta.msg }, { status: meta.status });
      }
    }
    // Partial unique index ihlali — aynı sipariş zaten atanmış
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Bu sipariş zaten bir fasona atanmış" },
        { status: 409 }
      );
    }
    if (msg.startsWith("order_status_locked:")) {
      const status = msg.split(":")[1] ?? "unknown";
      return NextResponse.json(
        { error: `Bu sipariş durumunda atama yapılamaz (${status})` },
        { status: 400 }
      );
    }
    console.error("[fason/assign] RPC error:", error);
    return NextResponse.json(
      { error: "Atama oluşturulamadı" },
      { status: 500 }
    );
  }

  const rows = (data as RpcRow[] | null) ?? [];
  const row = rows[0];
  if (!row) {
    return NextResponse.json(
      { error: "RPC sonucu beklenmedik" },
      { status: 500 }
    );
  }

  // Fason adı (mail göndermeden önce alındı — UI'da göstermek için bir
  // ekstra select; idempotent)
  const { data: fasonRow } = await admin
    .from("fason_partners")
    .select("name")
    .eq("id", fasonPartnerId)
    .maybeSingle();
  const fasonName = (fasonRow as { name?: string } | null)?.name ?? "";

  // Audit log (RPC dışı — asıl iş başarılı)
  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role === "admin" ? "admin" : "staff",
    action: "order.status_change",
    targetType: "order",
    targetId: orderId,
    summary: `Sipariş ${orderId} fason'a atandı: ${fasonName} (${row.order_status_before} → ${row.order_status_after})`,
    detail: {
      kind: "fason_assigned",
      assignment_id: row.assignment_id,
      fason_id: fasonPartnerId,
      fason_name: fasonName,
      estimated_delivery: estimatedDelivery,
      status_before: row.order_status_before,
      status_after: row.order_status_after,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    assignmentId: row.assignment_id,
    fasonToken: row.fason_token,
    fasonName,
    orderStatusBefore: row.order_status_before,
    orderStatusAfter: row.order_status_after,
  });
}
