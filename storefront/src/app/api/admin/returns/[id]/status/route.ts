/**
 * POST /api/admin/returns/[id]/status
 *
 * Admin iade talebi durumu güncelle + müşteri maili.
 * Body: { status: "approved" | "rejected" | "refunded", adminNote?, refundAmount? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

const BodySchema = z.object({
  status: z.enum(["approved", "rejected", "refunded"]),
  adminNote: z.string().min(1).max(2000).optional(),
  refundAmount: z.number().positive().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("returns", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: returnId } = await params;
  if (!returnId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.status === "rejected" && !body.adminNote?.trim()) {
    return NextResponse.json(
      { error: "admin_note_required_for_reject" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from("returns")
    .select("*")
    .eq("id", returnId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "return_not_found" }, { status: 404 });
  }

  const row = existing as {
    id: string;
    order_id: string;
    user_id: string;
    status: string;
    admin_note: string | null;
  };

  const updatePayload: {
    status: Enums<"return_status">;
    admin_note?: string;
    refund_amount?: number;
  } = {
    status: body.status,
  };
  if (body.adminNote) {
    updatePayload.admin_note = body.adminNote.trim();
  }
  if (body.refundAmount != null) {
    updatePayload.refund_amount = body.refundAmount;
  }

  const { data: updated, error: updateErr } = await admin
    .from("returns")
    .update(updatePayload)
    .eq("id", returnId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    console.error("[admin/returns/status]", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const {
    sendRefundApproved,
    sendRefundRejected,
  } = await import("@/lib/mail/notifications");

  if (body.status === "approved") {
    void sendRefundApproved({
      userId: row.user_id,
      orderId: row.order_id,
      returnId,
      adminNote:
        body.adminNote?.trim() ??
        "İade talebin onaylandı. Ürünü kargoyla geri gönder; eline ulaşınca para iadesi başlatılır.",
    }).catch((err) =>
      console.error("[admin/returns/status] approved mail:", err)
    );
  } else if (body.status === "rejected") {
    void sendRefundRejected({
      userId: row.user_id,
      orderId: row.order_id,
      returnId,
      operatorNote: body.adminNote,
    }).catch((err) =>
      console.error("[admin/returns/status] rejected mail:", err)
    );
  }

  await admin.from("order_events").insert([
    {
      order_id: row.order_id,
      event_type: "return_status_changed",
      status_after: null,
      actor_id: auth.user.id,
      actor_role: auth.role,
      summary: `İade ${body.status}: ${returnId.slice(0, 8)}…`,
      detail: {
        returnId,
        status: body.status,
        adminNote: body.adminNote ?? null,
      },
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({ ok: true, return: updated });
}
