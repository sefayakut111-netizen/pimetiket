/**
 * POST /api/admin/ai-qc/decide
 *
 * Admin AI QC kuyruğunda operatör kararını uygula.
 *
 * Body:
 *   {
 *     orderId: string,
 *     decision: "approve" | "reject",
 *     note?: string  // operatör notu (audit log için)
 *   }
 *
 * - approve → orders.status = "ready_to_ship" (üretime gönder)
 * - reject  → orders.status = "human_review_failed" (müşteriye düzeltme bildirimi)
 *
 * Sefa kuralı (16 May v3): bu kararlar order_events tablosuna kayıt
 * düşer (audit trail). Reject durumunda müşteriye otomatik mail gider
 * (sonraki commit).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/supabase/assert-permission";

const BodySchema = z.object({
  orderId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  // Sefa 18 May v68 (RBAC yayma): AI QC kararı production yetkisi
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

  const nextStatus =
    body.decision === "approve" ? "ready_to_ship" : "human_review_failed";

  // 1) Order status update — guard: yalnızca QC kuyruğundaki statüsler
  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({ status: nextStatus } as never)
    .eq("id", body.orderId)
    .in("status", [
      "human_review",
      "human_review_failed",
      "proof_generating",
    ] as never)
    .select("id, status")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      {
        error: "Update failed",
        detail: updateErr?.message ?? "order_not_in_qc_queue",
      },
      { status: 400 }
    );
  }

  // 2) Order event audit
  const eventType =
    body.decision === "approve" ? "qc_approved" : "qc_rejected";

  await admin.from("order_events").insert({
    order_id: body.orderId,
    event_type: eventType,
    payload: {
      operator: auth.user.email ?? auth.user.id,
      note: body.note ?? null,
      next_status: nextStatus,
    },
  } as never);

  return NextResponse.json({
    ok: true,
    orderId: body.orderId,
    newStatus: nextStatus,
  });
}
