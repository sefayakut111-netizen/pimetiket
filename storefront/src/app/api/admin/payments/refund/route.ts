import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { logServerAudit } from "@/lib/audit-log-server";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const auth = await assertPermission("finans", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { paymentId?: string; amount?: number; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.paymentId) {
    return NextResponse.json({ error: "paymentId gerekli" }, { status: 400 });
  }

  const admin = serviceClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, action, amount, status")
    .eq("id", body.paymentId)
    .maybeSingle();

  const row = payment as {
    id: string;
    order_id: string;
    action: string;
    amount: number;
    status: string;
  } | null;

  if (!row) {
    return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });
  }

  if (row.action !== "charge" || row.status !== "success") {
    return NextResponse.json(
      { error: "Sadece başarılı tahsilat iade edilebilir" },
      { status: 400 }
    );
  }

  const refundAmount = body.amount ?? row.amount;
  if (refundAmount > row.amount) {
    return NextResponse.json(
      { error: "İade tutarı orijinal tutarı aşamaz" },
      { status: 400 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const cookie = req.headers.get("cookie") ?? "";

  const res = await fetch(`${origin}/api/payment/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      orderId: row.order_id,
      amount: refundAmount,
      reason: body.reason ?? "Admin panelinden iade",
    }),
  });

  const json = await res.json().catch(() => ({}));

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "order.refund",
    targetType: "payment",
    targetId: row.id,
    summary: `Admin iade: ${row.order_id} — ${refundAmount} ₺`,
    detail: { orderId: row.order_id, amount: refundAmount, reason: body.reason },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  if (!res.ok) {
    return NextResponse.json(json, { status: res.status });
  }

  return NextResponse.json(json);
}
