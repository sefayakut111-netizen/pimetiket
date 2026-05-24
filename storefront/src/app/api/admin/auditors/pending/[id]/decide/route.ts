/**
 * POST /api/admin/auditors/pending/[id]/decide
 *
 * Sefa'nın onay kararını uygula. 4 karar yolu:
 *
 *   { decision: "approve" }
 *     → status='approved', sonra executePendingAction çağırılır.
 *     ACTION_REGISTRY'de handler yoksa status='failed' + apply_error.
 *
 *   { decision: "approve_with_edit", editedPayload: {...} }
 *     → action_payload kolonu güncellenir, sonra approve.
 *
 *   { decision: "snooze", snoozeDays?: 7 }
 *     → status='snoozed', snooze_until = now() + N gün.
 *     Sürede gelince tekrar pending olur (UI yeniden gösterir).
 *
 *   { decision: "reject", note?: string }
 *     → status='rejected'. Aksiyon UYGULANMAZ.
 *
 * Body opsiyonel: { note?: string } her karar için audit'e geçer.
 *
 * Response:
 *   { ok: true, status, applyResult? }
 *   { ok: false, error }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { executePendingAction } from "@/lib/agents/_shared/proposal";
import { sendActionAppliedNotification } from "@/lib/agents/_shared/mailer";
import type {
  AuditorPendingActionRow,
  AuditorName,
} from "@/lib/agents/_shared/types";

const BodySchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    note: z.string().max(2000).optional(),
  }),
  z.object({
    decision: z.literal("approve_with_edit"),
    editedPayload: z.record(z.string(), z.unknown()),
    note: z.string().max(2000).optional(),
  }),
  z.object({
    decision: z.literal("snooze"),
    snoozeDays: z.number().int().min(1).max(90).default(7),
    note: z.string().max(2000).optional(),
  }),
  z.object({
    decision: z.literal("reject"),
    note: z.string().max(2000).optional(),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("auditors", "approve");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Body parse
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

  // 1) Pending action'ı çek + status kontrolü
  const { data: pendingRow, error: fetchErr } = await admin
    .from("auditor_pending_actions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !pendingRow) {
    return NextResponse.json(
      { error: "pending_not_found", detail: fetchErr?.message },
      { status: 404 }
    );
  }

  const pending = pendingRow as unknown as AuditorPendingActionRow;

  if (pending.status !== "pending") {
    return NextResponse.json(
      {
        error: "invalid_status",
        detail: `Bu aksiyon zaten "${pending.status}" durumunda. Tekrar karar verilemez.`,
        currentStatus: pending.status,
      },
      { status: 409 }
    );
  }

  // 2) Karar tipine göre dispatch
  const reviewedAt = new Date().toISOString();
  const note = body.note ?? null;

  if (body.decision === "snooze") {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + body.snoozeDays);

    const { error } = await admin
      .from("auditor_pending_actions")
      .update({
        status: "snoozed",
        reviewed_by: auth.user.id,
        reviewed_at: reviewedAt,
        review_note: note,
        snooze_until: snoozeUntil.toISOString(),
      } as never)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "snoozed",
      snoozeUntil: snoozeUntil.toISOString(),
    });
  }

  if (body.decision === "reject") {
    const { error } = await admin
      .from("auditor_pending_actions")
      .update({
        status: "rejected",
        reviewed_by: auth.user.id,
        reviewed_at: reviewedAt,
        review_note: note,
      } as never)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "rejected",
    });
  }

  // approve veya approve_with_edit — execute akışı
  let actionPayload = pending.action_payload;

  if (body.decision === "approve_with_edit") {
    actionPayload = body.editedPayload;
    // action_payload kolonunu güncelle
    await admin
      .from("auditor_pending_actions")
      .update({ action_payload: actionPayload } as never)
      .eq("id", id);
  }

  // 3) Status='approved' set et
  const { error: approveErr } = await admin
    .from("auditor_pending_actions")
    .update({
      status: "approved",
      reviewed_by: auth.user.id,
      reviewed_at: reviewedAt,
      review_note: note,
    } as never)
    .eq("id", id);

  if (approveErr) {
    return NextResponse.json(
      { error: "approve_update_failed", detail: approveErr.message },
      { status: 500 }
    );
  }

  // 4) executePendingAction — handler yoksa "failed" döner ama bu Adım 4'e
  // kadar normal (ACTION_REGISTRY henüz boş).
  let executeResult: {
    logId: string;
    result: string;
    error?: string;
  } | null = null;

  try {
    executeResult = await executePendingAction({
      pendingActionId: id,
      executedBy: auth.user.id,
      reviewNote: note,
    });
  } catch (err) {
    executeResult = {
      logId: "",
      result: "failed",
      error: err instanceof Error ? err.message : "execute_threw",
    };
  }

  // 5) Aksiyon uygulandı bildirimi (fire-and-forget — mail başarısız olsa
  // bile karar kaydı geçerli)
  void sendActionAppliedNotification({
    auditorName: pending.auditor_name as AuditorName,
    pendingActionId: id,
    title: pending.title,
    result:
      executeResult.result === "success"
        ? "success"
        : executeResult.result === "partial"
          ? "partial"
          : "failed",
    error: executeResult.error,
  }).catch(() => {
    // sessiz: mail config olmasa bile sistem akışı devam etmeli
  });

  return NextResponse.json({
    ok: true,
    status: executeResult.result === "success" ? "applied" : "failed",
    applyResult: executeResult,
  });
}
