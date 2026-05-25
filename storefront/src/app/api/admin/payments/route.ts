import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type PaymentRow = {
  id: string;
  order_id: string;
  action: string;
  amount: number;
  status: string;
  card_masked: string | null;
  psp_transaction_id: string | null;
  psp_provider: string;
  created_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  psp_raw: Record<string, unknown> | null;
};

export async function GET(req: Request) {
  const auth = await assertPermission("finans", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const admin = serviceClient();

  let query = admin
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data: payments, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (payments ?? []) as PaymentRow[];
  const orderIds = [...new Set(rows.map((p) => p.order_id))];

  const { data: orders } = await admin
    .from("orders")
    .select("id, user_id, total")
    .in("id", orderIds.length ? orderIds : ["__none__"]);

  const userIds = [
    ...new Set(
      ((orders ?? []) as { user_id: string }[]).map((o) => o.user_id).filter(Boolean)
    ),
  ];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds.length ? userIds : ["__none__"]);

  const orderMap = new Map(
    ((orders ?? []) as Array<{ id: string; user_id: string; total: number }>).map(
      (o) => [o.id, o]
    )
  );
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map(
      (p) => [p.id, p]
    )
  );

  let filtered = rows.map((p) => {
    const order = orderMap.get(p.order_id);
    const profile = order ? profileMap.get(order.user_id) : undefined;
    return {
      id: p.id,
      orderId: p.order_id,
      action: p.action,
      amount: p.amount,
      status: p.status,
      cardMasked: p.card_masked,
      pspTransactionId: p.psp_transaction_id,
      pspProvider: p.psp_provider,
      createdAt: p.created_at,
      completedAt: p.completed_at,
      failureReason: p.failure_reason,
      customerEmail: profile?.email ?? null,
      customerName: profile?.full_name ?? null,
      orderTotal: order?.total ?? null,
      pspRaw: p.psp_raw,
    };
  });

  if (statusFilter === "success") {
    filtered = filtered.filter(
      (p) => p.status === "success" && p.action === "charge"
    );
  } else if (statusFilter === "pending") {
    filtered = filtered.filter((p) =>
      ["pending", "processing"].includes(p.status)
    );
  } else if (statusFilter === "failed") {
    filtered = filtered.filter((p) => p.status === "failed");
  } else if (statusFilter === "refunded") {
    filtered = filtered.filter(
      (p) =>
        p.status === "success" &&
        (p.action === "refund" || p.action === "partial_refund")
    );
  }

  if (q) {
    filtered = filtered.filter(
      (p) =>
        p.orderId.toLowerCase().includes(q) ||
        (p.customerEmail?.toLowerCase().includes(q) ?? false) ||
        (p.customerName?.toLowerCase().includes(q) ?? false) ||
        (p.pspTransactionId?.toLowerCase().includes(q) ?? false)
    );
  }

  const charges = rows.filter((p) => p.action === "charge" && p.status === "success");
  const pending = rows.filter((p) =>
    ["pending", "processing"].includes(p.status)
  );
  const refunds = rows.filter(
    (p) =>
      p.status === "success" &&
      (p.action === "refund" || p.action === "partial_refund")
  );
  const failed = rows.filter((p) => p.status === "failed");

  const totals = {
    revenue: charges.reduce((s, p) => s + Number(p.amount), 0),
    pending: pending.reduce((s, p) => s + Number(p.amount), 0),
    refunded: refunds.reduce((s, p) => s + Number(p.amount), 0),
    failed: failed.length,
  };

  return NextResponse.json({ ok: true, payments: filtered, totals });
}
