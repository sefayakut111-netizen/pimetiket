/**
 * POST /api/admin/ai-qc/decide
 *
 * Admin AI QC kuyruğunda operatör kararını uygula.
 *
 * Body:
 *   {
 *     orderId: string,
 *     decision: "approve" | "reject" | "fix_and_proof",
 *     note?: string  // operatör notu (audit log için)
 *   }
 *
 * Kaynak durumlar: AI_QC_ACTIVE_STATUSES (qc_pending / qc_flagged / human_review / human_review_failed).
 *   - approve → ready_to_ship
 *   - fix_and_proof → proof_generating
 *   - reject → human_review_failed (+ müşteriye düzeltme maili)
 *
 * NOT: operator_print_review (baskı öncesi inceleme) bu kuyruğa DAHİL DEĞİL (AI_QC_ACTIVE_STATUSES
 * dışında) — baskı incelemesi /admin/prova → /api/admin/orders/[id]/status (admin_override) ile
 * ilerletilir. Bu yüzden bu route'ta print-review dalı YOKTUR.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  transitionOrderStatus,
  transitionHttpStatus,
} from "@/lib/db/transition-order-status";
import { AI_QC_ACTIVE_STATUSES, isOrderStatus } from "@/lib/order";

const BodySchema = z.object({
  orderId: z.string().min(1),
  decision: z.enum(["approve", "reject", "fix_and_proof"]),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const auth = await assertPermission("ai_qc", "approve");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json()) as unknown;
    body = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid body",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: currentOrder, error: fetchErr } = await admin
    .from("orders")
    .select("status")
    .eq("id", body.orderId)
    .single();

  if (fetchErr || !currentOrder) {
    return NextResponse.json(
      { error: "Order not found", detail: fetchErr?.message },
      { status: 404 }
    );
  }

  const fromStatus = currentOrder.status as string;
  if (!isOrderStatus(fromStatus)) {
    return NextResponse.json(
      { error: "Update failed", detail: "invalid_order_status" },
      { status: 400 }
    );
  }
  if (
    !(AI_QC_ACTIVE_STATUSES as readonly string[]).includes(fromStatus)
  ) {
    return NextResponse.json(
      { error: "Update failed", detail: "order_not_in_qc_queue" },
      { status: 400 }
    );
  }

  const nextStatus =
    body.decision === "approve"
      ? "ready_to_ship"
      : body.decision === "fix_and_proof"
        ? "proof_generating"
        : "human_review_failed";

  const eventType =
    body.decision === "approve"
      ? "qc_approved"
      : body.decision === "fix_and_proof"
        ? "qc_fixed_by_operator"
        : "qc_rejected";

  const summary =
    body.decision === "approve"
      ? "AI QC onaylandı → üretime hazır"
      : body.decision === "fix_and_proof"
        ? "Operatör düzeltecek → prova hazırlanıyor"
        : "AI QC reddedildi → düzeltme istendi";

  const transitionResult = await transitionOrderStatus(admin, {
    orderId: body.orderId,
    to: nextStatus,
    from: fromStatus,
    mode: "forward",
    actorId: auth.user.id,
    actorRole: auth.role === "admin" ? "admin" : "staff",
    eventType,
    summary,
    detail: {
      operator: auth.user.email ?? auth.user.id,
      note: body.note ?? null,
      next_status: nextStatus,
      from_status: fromStatus,
    },
  });

  if (!transitionResult.ok) {
    return NextResponse.json(
      {
        error: "Update failed",
        detail: transitionResult.error,
      },
      { status: transitionHttpStatus(transitionResult.error) }
    );
  }

  if (body.decision === "reject") {
    const { data: orderData } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", body.orderId)
      .maybeSingle();
    const userId = (orderData as { user_id?: string } | null)?.user_id;
    if (userId) {
      const { sendQcRejected } = await import("@/lib/mail/notifications");
      void sendQcRejected({
        userId,
        orderId: body.orderId,
        reason: body.note ?? "Operatör düzeltme istedi",
        issueCategory: "other",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    orderId: body.orderId,
    newStatus: nextStatus,
  });
}
