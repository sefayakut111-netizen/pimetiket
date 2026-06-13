/**
 * POST /api/admin/orders/bulk-status — toplu sipariş status güncelleme.
 * Body: { orderIds: string[], newStatus: string, reason?: string }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  transitionOrderStatus,
} from "@/lib/db/transition-order-status";
import { isOrderStatus, isValidBulkTransition, type OrderStatus } from "@/lib/order";

interface BodyShape {
  orderIds?: unknown;
  newStatus?: unknown;
  reason?: unknown;
}

export async function POST(req: Request) {
  const auth = await assertPermission("orders", "update");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray(body.orderIds)
    ? body.orderIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const newStatus =
    typeof body.newStatus === "string" && isOrderStatus(body.newStatus)
      ? body.newStatus
      : null;
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: false, error: "orderIds gerekli" }, { status: 400 });
  }
  if (!newStatus) {
    return NextResponse.json({ ok: false, error: "Geçersiz status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rows, error: fetchErr } = await admin
    .from("orders")
    .select("id, status")
    .in("id", orderIds);

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }

  const byId = new Map(
    (rows ?? []).map((r) => [r.id as string, r.status as OrderStatus])
  );

  const actorRole = auth.role === "admin" ? "admin" : "staff";
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const orderId of orderIds) {
    const current = byId.get(orderId);
    if (!current) {
      skipped++;
      errors.push(`${orderId}: bulunamadı`);
      continue;
    }
    if (current === newStatus) {
      skipped++;
      continue;
    }
    if (!isValidBulkTransition(current, newStatus)) {
      skipped++;
      errors.push(`${orderId}: ${current} → ${newStatus} geçersiz`);
      continue;
    }

    const result = await transitionOrderStatus(admin, {
      orderId,
      to: newStatus,
      from: current,
      mode: "bulk",
      actorId: auth.user.id,
      actorRole,
      eventType: "bulk_status_change",
      summary: `Toplu status: ${current} → ${newStatus}${reason ? " · " + reason : ""}`,
      detail: { from: current, to: newStatus, reason },
      audit: {
        action: newStatus === "cancelled" ? "order.cancel" : "order.status_change",
        summary: `Toplu: ${orderId} ${current} → ${newStatus}`,
        detail: { from: current, to: newStatus, reason, bulk: true },
        actorEmail: auth.user.email ?? null,
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      },
    });

    if (!result.ok) {
      skipped++;
      errors.push(`${orderId}: ${result.error}`);
      continue;
    }

    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped, errors });
}
