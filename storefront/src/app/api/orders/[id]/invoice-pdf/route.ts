/**
 * GET /api/orders/[id]/invoice-pdf
 *
 * Müşteriye basit sipariş fatura özeti PDF'i döner.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInvoicePdf } from "@/lib/invoice/generate-invoice-pdf";
import type { CustomerOrderAddress, CustomerOrderInvoice, CustomerOrderPayment } from "@/lib/customer-order";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orderRow, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, subtotal, shipping, total, address, invoice, payment, created_at")
    .eq("id", orderId)
    .single();

  if (orderErr || !orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const order = orderRow as {
    id: string;
    user_id: string | null;
    subtotal: number;
    shipping: number;
    total: number;
    address: unknown;
    invoice: unknown;
    payment: unknown;
    created_at: string;
  };

  if (!order.user_id || order.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: items } = await admin
    .from("order_items")
    .select("title, qty, unit")
    .eq("order_id", orderId);

  const lineItems = (
    (items as Array<{ title: string; qty: number; unit: number }> | null) ?? []
  ).map((item) => ({
    title: item.title,
    qty: item.qty,
    unitPrice: item.unit,
    lineTotal: item.qty * item.unit,
  }));

  const pdfBytes = await generateInvoicePdf({
    orderId: order.id,
    createdAt: new Date(order.created_at),
    invoice: order.invoice as CustomerOrderInvoice,
    address: order.address as CustomerOrderAddress,
    payment: order.payment as CustomerOrderPayment,
    items: lineItems,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fatura-${orderId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
