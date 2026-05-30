/**
 * GET /api/admin/financials/monthly-pack?month=YYYY-MM&format=pdf|csv
 *
 * Aylık muhasebe paketi — tahsilat, iade, KDV özeti, sipariş sayısı.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { isTestOrderLike } from "@/lib/admin-order-filters";
import {
  generateMonthlyAccountingPdf,
  monthlyAccountingToCsv,
  monthWindow,
  parseMonthParam,
  type MonthlyAccountingData,
} from "@/lib/finance/generate-monthly-accounting-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function loadMonthlyData(
  year: number,
  month: number,
  excludeTest: boolean
): Promise<MonthlyAccountingData> {
  const { start, end } = monthWindow(year, month);
  const admin = serviceClient();

  const [{ data: orders }, { data: payments }] = await Promise.all([
    admin
      .from("orders")
      .select("id, total, status, created_at, address")
      .gte("created_at", start)
      .lte("created_at", end),
    admin
      .from("payments")
      .select("amount, action, status, created_at, order_id")
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

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

  const collectedTotal = paymentRows
    .filter((p) => p.action === "charge" && p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);

  const refundedTotal = paymentRows
    .filter(
      (p) =>
        p.status === "success" &&
        (p.action === "refund" || p.action === "partial_refund")
    )
    .reduce((s, p) => s + Number(p.amount), 0);

  const netRevenue = grossOrderTotal / 1.2;
  const kdvAmount = grossOrderTotal - netRevenue;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  return {
    year,
    month,
    monthLabel,
    collectedTotal,
    refundedTotal,
    grossOrderTotal,
    netRevenue,
    kdvAmount,
    orderCount: orderRows.filter((o) => o.status !== "cancelled").length,
    paymentCount: paymentRows.filter(
      (p) => p.action === "charge" && p.status === "success"
    ).length,
  };
}

export async function GET(req: Request) {
  const auth = await assertPermission("finans", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = parseMonthParam(url.searchParams.get("month"));
  if (!parsed) {
    return NextResponse.json(
      { error: "month param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  const excludeTest = url.searchParams.get("excludeTest") !== "0";
  const data = await loadMonthlyData(parsed.year, parsed.month, excludeTest);
  const filenameBase = `pim-muhasebe-${parsed.year}-${String(parsed.month).padStart(2, "0")}`;

  if (format === "csv") {
    const csv = monthlyAccountingToCsv(data);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const pdf = await generateMonthlyAccountingPdf(data);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
