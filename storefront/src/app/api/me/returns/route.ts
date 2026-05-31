/**
 * POST /api/me/returns — müşteri iade talebi (sunucu doğrulamalı).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const ELIGIBLE_ORDER_STATUSES = [
  "delivered",
  "shipped",
  "in_production",
] as const;

const BodySchema = z.object({
  orderId: z.string().min(1),
  reason: z.enum([
    "yanlis_urun",
    "uretim_hatasi",
    "kargo_hasari",
    "kalite_problemi",
    "diger",
  ]),
  description: z.string().min(20).max(500),
  attachments: z.array(z.string()).max(10).optional(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
});

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", body.orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const orderRow = order as { id: string; user_id: string; status: string };
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (
    !ELIGIBLE_ORDER_STATUSES.includes(
      orderRow.status as (typeof ELIGIBLE_ORDER_STATUSES)[number]
    )
  ) {
    return NextResponse.json({ error: "return_not_eligible" }, { status: 400 });
  }

  const { data: pendingReturn } = await admin
    .from("returns")
    .select("id")
    .eq("order_id", body.orderId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingReturn) {
    return NextResponse.json(
      { error: "return_already_pending" },
      { status: 409 }
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from("returns")
    .insert({
      order_id: body.orderId,
      user_id: user.id,
      customer_name: body.customerName,
      customer_email: body.customerEmail,
      reason: body.reason as Enums<"return_reason">,
      description: body.description.trim(),
      attachments: body.attachments ?? [],
    } satisfies TablesInsert<"returns">)
    .select("*")
    .single();

  if (insertErr || !inserted) {
    console.error("[me/returns POST]", insertErr);
    return NextResponse.json({ error: "return_create_failed" }, { status: 500 });
  }

  const row = inserted as {
    id: string;
    order_id: string;
    customer_name: string;
    customer_email: string;
    reason: string;
    description: string;
    attachments: string[];
    status: string;
    admin_note: string | null;
    refund_amount: number | null;
    created_at: string;
    updated_at: string;
  };

  return NextResponse.json({
    return: {
      id: row.id,
      orderId: row.order_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      reason: row.reason,
      description: row.description,
      attachments: row.attachments ?? [],
      status: row.status,
      adminNote: row.admin_note ?? undefined,
      refundAmount:
        row.refund_amount != null ? Number(row.refund_amount) : undefined,
      createdAt: new Date(row.created_at).getTime(),
      createdAtIso: row.created_at,
      updatedAt: new Date(row.updated_at).getTime(),
      updatedAtIso: row.updated_at,
    },
  });
}
