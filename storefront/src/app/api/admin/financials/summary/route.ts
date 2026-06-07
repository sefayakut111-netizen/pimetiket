import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { isTestOrderLike } from "@/lib/admin-order-filters";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

type RangeKey = "today" | "7d" | "mtd" | "30d" | "all" | "custom";

function getRangeWindow(
  range: RangeKey,
  customFrom?: string | null,
  customTo?: string | null
): { start: string | null; end: string } {
  const now = new Date();
  const end = now.toISOString();
  if (range === "today") {
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    return { start: startOfDay.toISOString(), end };
  }
  if (range === "7d") {
    return { start: new Date(now.getTime() - 7 * DAY).toISOString(), end };
  }
  if (range === "30d") {
    return { start: new Date(now.getTime() - 30 * DAY).toISOString(), end };
  }
  if (range === "mtd") {
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    return { start: startOfMonth.toISOString(), end };
  }
  if (range === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return { start: from.toISOString(), end: to.toISOString() };
  }
  return { start: null, end };
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const auth = await assertPermission("finans", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "mtd";
  const customFrom = url.searchParams.get("from");
  const customTo = url.searchParams.get("to");
  const range = (
    ["today", "7d", "mtd", "30d", "all", "custom"].includes(rangeParam)
      ? rangeParam
      : "mtd"
  ) as RangeKey;
  const excludeTest = url.searchParams.get("excludeTest") === "1";
  const { start, end } = getRangeWindow(range, customFrom, customTo);

  const admin = serviceClient();

  let ordersQuery = admin
    .from("orders")
    .select("id, total, status, created_at, address")
    .lte("created_at", end);
  if (start) ordersQuery = ordersQuery.gte("created_at", start);

  let paymentsQuery = admin
    .from("payments")
    .select("amount, action, status, created_at, order_id")
    .lte("created_at", end);
  if (start) paymentsQuery = paymentsQuery.gte("created_at", start);

  const [{ data: orders, error: ordersErr }, { data: payments, error: payErr }, { count: needsReviewCount }, { count: couponFailCount }] =
    await Promise.all([
      ordersQuery,
      paymentsQuery,
      admin
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("status", "needs_review"),
      admin
        .from("order_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "coupon_apply_failed")
        .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()),
    ]);

  if (ordersErr || payErr) {
    return NextResponse.json(
      { error: ordersErr?.message ?? payErr?.message ?? "Query failed" },
      { status: 500 }
    );
  }

  type OrderRow = {
    id: string;
    total: number;
    status: string;
    address?: { name?: string } | null;
  };

  let orderRows = (orders ?? []) as OrderRow[];
  const allOrderRows = orderRows;
  if (excludeTest) {
    orderRows = orderRows.filter((o) => !isTestOrderLike(o));
  }
  let paymentRows = (payments ?? []) as Array<{
    amount: number;
    action: string;
    status: string;
    order_id: string | null;
  }>;
  if (excludeTest) {
    const testIds = new Set(
      allOrderRows.filter((o) => isTestOrderLike(o)).map((o) => o.id)
    );
    paymentRows = paymentRows.filter(
      (p) => !p.order_id || !testIds.has(p.order_id)
    );
  }

  const grossOrderTotal = orderRows
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const cancelledOrderTotal = orderRows
    .filter((o) => o.status === "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const collectedTotal = paymentRows
    .filter((p) => p.action === "charge" && p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);

  const pendingTotal = paymentRows
    .filter((p) => ["pending", "processing"].includes(p.status))
    .reduce((s, p) => s + Number(p.amount), 0);

  const refundedTotal = paymentRows
    .filter(
      (p) =>
        p.status === "success" &&
        (p.action === "refund" || p.action === "partial_refund")
    )
    .reduce((s, p) => s + Number(p.amount), 0);

  const gap = grossOrderTotal - collectedTotal;

  return NextResponse.json({
    ok: true,
    range,
    grossOrderTotal,
    collectedTotal,
    cancelledOrderTotal,
    pendingTotal,
    refundedTotal,
    gap,
    orderCount: orderRows.filter((o) => o.status !== "cancelled").length,
    paymentCount: paymentRows.filter(
      (p) => p.action === "charge" && p.status === "success"
    ).length,
    paraAlerts: {
      needsReviewCount: needsReviewCount ?? 0,
      couponApplyFailed30d: couponFailCount ?? 0,
    },
  });
}
