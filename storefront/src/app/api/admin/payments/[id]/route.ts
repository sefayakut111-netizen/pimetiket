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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("finans", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const admin = serviceClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });
  }

  const row = payment as {
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

  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, total, address")
    .eq("id", row.order_id)
    .maybeSingle();

  const orderRow = order as {
    id: string;
    user_id: string | null;
    total: number;
    address: { name?: string; email?: string; phone?: string } | null;
  } | null;

  let customerEmail: string | null = orderRow?.address?.email ?? null;
  let customerName: string | null = orderRow?.address?.name ?? null;

  if (orderRow?.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, phone")
      .eq("id", orderRow.user_id)
      .maybeSingle();
    if (profile) {
      const p = profile as { display_name: string | null; phone: string | null };
      customerName = p.display_name ?? customerName;
    }
    try {
      const { data: u } = await admin.auth.admin.getUserById(orderRow.user_id);
      if (u?.user?.email) customerEmail = u.user.email;
    } catch {
      /* skip */
    }
  }

  const { data: related } = await admin
    .from("payments")
    .select("id, action, amount, status, created_at, psp_transaction_id")
    .eq("order_id", row.order_id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    payment: {
      id: row.id,
      orderId: row.order_id,
      action: row.action,
      amount: row.amount,
      status: row.status,
      cardMasked: row.card_masked,
      pspTransactionId: row.psp_transaction_id,
      pspProvider: row.psp_provider,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      failureReason: row.failure_reason,
      customerEmail,
      customerName,
      orderTotal: orderRow?.total ?? null,
      pspRaw: row.psp_raw,
    },
    relatedPayments: (related ?? []).map((p) => {
      const r = p as {
        id: string;
        action: string;
        amount: number;
        status: string;
        created_at: string;
        psp_transaction_id: string | null;
      };
      return {
        id: r.id,
        action: r.action,
        amount: r.amount,
        status: r.status,
        createdAt: r.created_at,
        pspTransactionId: r.psp_transaction_id,
      };
    }),
  });
}
