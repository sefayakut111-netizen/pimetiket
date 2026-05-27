import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { isTestOrderLike } from "@/lib/admin-order-filters";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

type RangeKey = "7d" | "mtd" | "30d" | "all";

function getRangeWindow(range: RangeKey): { start: string | null; end: string } {
  const now = new Date();
  const end = now.toISOString();
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
  const range = (url.searchParams.get("range") ?? "mtd") as RangeKey;
  const excludeTest = url.searchParams.get("excludeTest") === "1";
  const { start, end } = getRangeWindow(
    ["7d", "mtd", "30d", "all"].includes(range) ? range : "mtd"
  );

  const admin = serviceClient();

  let ordersQuery = admin
    .from("orders")
    .select("id, total, status, created_at, address")
    .lte("created_at", end);
  if (start) ordersQuery = ordersQuery.gte("created_at", start);

  let paymentsQuery = admin
    .from("payments")
    .select("amount, action, status, created_at")
    .lte("created_at", end);
  if (start) paymentsQuery = paymentsQuery.gte("created_at", start);

  const [{ data: orders, error: ordersErr }, { data: payments, error: payErr }] =
    await Promise.all([ordersQuery, paymentsQuery]);

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
  if (excludeTest) {
    orderRows = orderRows.filter((o) => !isTestOrderLike(o));
  }
  const paymentRows = (payments ?? []) as Array<{
    amount: number;
    action: string;
    status: string;
  }>;

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
  });
}
