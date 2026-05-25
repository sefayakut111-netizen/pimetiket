/**
 * POST /api/admin/orders/[id]/remind-proof
 *
 * Müşteriye prova hatırlatma maili — mail outbox + order_events audit.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { logOrderEvent } from "@/lib/order-events-server";
import { sendOrderProofReminder } from "@/lib/mail/notifications";
import { render } from "@react-email/render";
import { OrderProofReminderEmail } from "@/lib/mail/templates/order-proof-reminder";
import { enqueueMail } from "@/lib/mail/enqueue";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("proof", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, status, user_id, created_at, address")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const row = order as {
    id: string;
    status: string;
    user_id: string | null;
    created_at: string;
    address: { name?: string; email?: string } | null;
  };

  if (row.status !== "proof_pending") {
    return NextResponse.json(
      { error: "Sipariş prova onayı beklemiyor" },
      { status: 409 }
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents } = await admin
    .from("order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event_type", "proof_reminder_sent")
    .gte("created_at", since)
    .limit(1);

  if (recentEvents && recentEvents.length > 0) {
    return NextResponse.json(
      { error: "24 saat içinde zaten hatırlatma gönderildi" },
      { status: 429 }
    );
  }

  const { count: itemCount } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  const hoursSincePaid = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(row.created_at).getTime()) / 3600000
    )
  );

  let mailOk = false;
  let mailReason: string | undefined;

  if (row.user_id) {
    const result = await sendOrderProofReminder({
      userId: row.user_id,
      orderId,
      pendingCount: itemCount ?? 1,
      hoursSincePaid,
    });
    mailOk = result.ok;
    mailReason = result.reason;
  } else {
    const toEmail = row.address?.email?.trim();
    if (!toEmail) {
      return NextResponse.json(
        { error: "Müşteri e-posta adresi bulunamadı" },
        { status: 400 }
      );
    }
    const customerName = row.address?.name ?? "Müşteri";
    const html = await render(
      OrderProofReminderEmail({
        customerName,
        orderId,
        pendingCount: itemCount ?? 1,
        hoursSincePaid,
      })
    );
    const subject = `Baskı onayını bekliyoruz — ${orderId}`;
    const text = `Baskı onayı hatırlatma — ${orderId}. ${SITE_URL}/onay/${orderId}`;
    const today = new Date().toISOString().slice(0, 10);
    const result = await enqueueMail({
      templateKey: "_prerendered",
      to: toEmail,
      category: "customer",
      targetType: "order",
      targetId: orderId,
      subject,
      payload: {
        subject,
        html,
        text,
        _kind: "proof_reminder",
        _order_id: orderId,
      },
      idempotencyKey: `proof_reminder:${orderId}:${today}`,
    });
    mailOk = result.ok && !result.suppressed;
    mailReason = result.error ?? (result.suppressed ? "suppressed" : undefined);
  }

  if (!mailOk) {
    return NextResponse.json(
      {
        error: "Mail kuyruğa alınamadı",
        detail: mailReason ?? "unknown",
      },
      { status: 500 }
    );
  }

  await logOrderEvent(admin, {
    orderId,
    eventType: "proof_reminder_sent",
    statusAfter: row.status,
    actorId: auth.user.id,
    actorRole: auth.role === "admin" ? "admin" : "staff",
    summary: "Admin prova hatırlatma maili gönderdi",
    detail: {
      operator: auth.user.email ?? auth.user.id,
      channel: "email",
    },
  });

  return NextResponse.json({ ok: true, sent: true });
}
