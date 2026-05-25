/**
 * POST /api/admin/help-requests/[id]/respond
 *
 * Sefa 22 May v68 (Faz 4 — Uzman akışı):
 * Admin/operatör müşterinin proof_help_requests ticket'ına cevap verir.
 *
 * Body:
 *   {
 *     resolutionNote: string (10-2000),
 *     action: 'resolved' | 'dismissed'
 *   }
 *
 * Akış:
 *   1. proof_help_requests UPDATE (status, resolved_by, resolution_note, resolved_at)
 *   2. order_items.proof_status = 'pending' (müşteri tekrar inceleyebilsin)
 *   3. order_events log
 *   4. (TODO) Mail notification — proof_help_resolved template
 *
 * Auth: admin gate (admins tablo).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendProofHelpResolved } from "@/lib/mail/notifications";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  resolutionNote: z.string().min(10).max(2000),
  action: z.enum(["resolved", "dismissed"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: helpRequestId } = await params;
  if (!helpRequestId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("help_requests", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const { resolutionNote, action } = parsed.data;

  const admin = createAdminClient();

  // Help request fetch
  const { data: hrRow } = await admin
    .from("proof_help_requests")
    .select("id, order_id, order_item_id, user_id, status, message")
    .eq("id", helpRequestId)
    .maybeSingle();
  type HrRow = {
    id: string;
    order_id: string;
    order_item_id: string;
    user_id: string;
    status: string;
    message: string;
  };
  const hr = hrRow as HrRow | null;
  if (!hr) {
    return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
  }
  if (hr.status === "resolved" || hr.status === "dismissed") {
    return NextResponse.json(
      { error: `Talep zaten ${hr.status}` },
      { status: 400 }
    );
  }

  // Update
  const { error: updErr } = await admin
    .from("proof_help_requests")
    .update({
      status: action,
      resolution_note: resolutionNote,
      resolved_by: auth.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", helpRequestId);
  if (updErr) {
    console.error("[admin/help-requests/respond] update error:", updErr);
    return NextResponse.json(
      { error: "Cevap kaydedilemedi", detail: updErr.message },
      { status: 500 }
    );
  }

  // Item status'u geri çek — müşteri tekrar inceleyebilsin (pending'e dön)
  // dismissed durumunda da pending'e dön — müşteri cevabı görüp karar versin
  await admin
    .from("order_items")
    .update({ proof_status: "pending" })
    .eq("id", hr.order_item_id)
    .eq("proof_status", "help_requested");

  // Audit
  await admin.from("order_events").insert([
    {
      order_id: hr.order_id,
      event_type:
        action === "resolved"
          ? "proof_help_resolved"
          : "proof_help_dismissed",
      status_after: null,
      actor_id: auth.user.id,
      actor_role: "admin",
      summary: `Yardım talebi ${action} edildi: ${resolutionNote.slice(0, 80)}...`,
      detail: {
        help_request_id: helpRequestId,
        item_id: hr.order_item_id,
        resolution_note: resolutionNote,
        original_message: hr.message,
      },
    },
  ]);

  // Sefa 22 May v68 Faz 4b — Mail bildirim (sadece 'resolved' durumunda):
  // 'dismissed' = operatör müşteri yanıtı istemediğine karar verdi, mail spam'lemeyelim.
  // Fire-and-forget: mail hatası respond işlemini bozmamalı.
  if (action === "resolved") {
    // Item title'ı respond response'unda göstermek için çekelim
    const { data: itemRow } = await admin
      .from("order_items")
      .select("title")
      .eq("id", hr.order_item_id)
      .maybeSingle();
    const itemTitle =
      (itemRow as { title?: string } | null)?.title ?? "(ürün)";

    void sendProofHelpResolved({
      userId: hr.user_id,
      orderId: hr.order_id,
      helpRequestId: helpRequestId,
      itemTitle,
      originalMessage: hr.message,
      resolutionNote,
    }).catch((err) => {
      console.error("[admin/help-requests/respond] mail enqueue error:", err);
    });
  }

  return NextResponse.json({ ok: true });
}
