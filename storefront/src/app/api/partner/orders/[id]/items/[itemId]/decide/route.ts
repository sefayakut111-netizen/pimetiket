/**
 * POST /api/partner/orders/[id]/items/[itemId]/decide
 *
 * Sefa 23 May v68 (Partner P3):
 * Partner her item için ayrı karar verir.
 *
 * Body: {
 *   action: 'approve' | 'reject',
 *   note?: string (red için zorunlu, onayda opsiyonel)
 * }
 *
 * Akış:
 *   approve →
 *     order_items.proof_status = 'partner_approved'
 *     order_items.partner_decided_by = user.id
 *     order_items.partner_decided_at = now
 *     Tüm itemler partner_approved olunca:
 *       (atama durumu ayrı — partner status-action ile acknowledge → in_production)
 *
 *   reject →
 *     order_items.proof_status = 'partner_rejected'
 *     order_items.partner_decided_by = user.id
 *     order_items.partner_decision_note = note (gerekçe)
 *     En az 1 reject varsa:
 *       order_assignments.status → 'issue'
 *       order_assignments.issue_category = 'partner_rejected'
 *       order_assignments.issue_description = note
 *       Admin loop'u devreye girer.
 *
 * Revize yolları (canlı):
 *   - revise_editor: /partner/.../duzenle
 *   - revise_upload: /api/.../upload-revision (Mod B — müşteri prova maili)
 *
 * Auth:
 *   1) role='partner'
 *   2) Bu order bu partner'a atanmış mı (cross-tenant guard)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";
import {
  isPartnerDecideAllowed,
  isPartnerPending,
} from "@/lib/fason/partner-proof-status";
import { enqueueMail } from "@/lib/mail/enqueue";
import { z } from "zod";

export const runtime = "nodejs";

function getAdminNotificationEmails(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

async function resolvePartnerContactName(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  userId: string
): Promise<string | null> {
  const { data: rows } = await admin
    .from("partner_contacts")
    .select("name, role, user_id")
    .eq("partner_id", partnerId);

  const contacts = (rows ?? []) as Array<{
    name: string;
    role: string;
    user_id: string | null;
  }>;
  if (contacts.length === 0) return null;

  const byUser = contacts.find((c) => c.user_id === userId);
  if (byUser) return byUser.name;

  const owner = contacts.find((c) => c.role === "owner");
  if (owner) return owner.name;

  return contacts[0].name;
}

const BodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: rawOrderId, itemId } = await params;
  if (!rawOrderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  // Body parse
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
  const { action, note } = parsed.data;

  // Red için note zorunlu
  if (action === "reject" && (!note || note.trim().length < 10)) {
    return NextResponse.json(
      { error: "reject_note_required", message: "Red sebebi en az 10 karakter olmalı" },
      { status: 400 }
    );
  }

  // Auth — preview modunda yazma yasak
  const ctx = await resolvePartnerContext();
  if (!ctx || ctx.isPreview || !ctx.partnerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId;
  const userId = ctx.userId;

  const contactName = await resolvePartnerContactName(
    admin,
    partnerId,
    userId
  );
  if (!contactName) {
    return NextResponse.json(
      { error: "partner_link_missing" },
      { status: 404 }
    );
  }

  // Canonical order
  const { data: orderRow } = await admin
    .from("orders")
    .select("id")
    .ilike("id", rawOrderId)
    .maybeSingle();
  const order = orderRow as { id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const asg = await assertActivePartnerAssignment(
    admin,
    order.id,
    partnerId,
    "id, fason_partner_id, status"
  );
  if (!asg.ok) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }
  const assignment = asg.assignment;

  // Item validate
  const { data: itemRow } = await admin
    .from("order_items")
    .select("id, order_id, title, proof_status")
    .eq("id", itemId)
    .eq("order_id", order.id)
    .maybeSingle();
  type ItemRow = {
    id: string;
    order_id: string;
    title: string;
    proof_status: string;
  };
  const item = itemRow as ItemRow | null;
  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 });
  }

  if (!isPartnerDecideAllowed(item.proof_status)) {
    return NextResponse.json(
      {
        error: "already_decided",
        message: "Bu kalem için zaten karar verilmiş veya karar verilemez.",
      },
      { status: 409 }
    );
  }

  // Karar update
  const newProofStatus =
    action === "approve" ? "partner_approved" : "partner_rejected";
  const { error: updErr } = await admin
    .from("order_items")
    .update({
      proof_status: newProofStatus,
      partner_decided_by: userId,
      partner_decided_at: new Date().toISOString(),
      partner_decision_note: note ?? null,
    })
    .eq("id", itemId);
  if (updErr) {
    console.error("[partner/decide] update error:", updErr);
    return NextResponse.json(
      { error: "update_failed", detail: updErr.message },
      { status: 500 }
    );
  }

  // order_events audit
  await admin.from("order_events").insert([
    {
      order_id: order.id,
      event_type: action === "approve" ? "partner_approved_item" : "partner_rejected_item",
      actor_id: userId,
      actor_role: "partner",
      summary:
        action === "approve"
          ? `${contactName} (partner) ${item.title} tasarımını onayladı`
          : `${contactName} (partner) ${item.title} tasarımını reddetti: ${note?.slice(0, 80)}`,
      detail: {
        item_id: itemId,
        item_title: item.title,
        previous_status: item.proof_status,
        new_status: newProofStatus,
        partner_id: partnerId,
        note: note ?? null,
      },
    },
  ]);

  // Tüm itemleri tekrar çek — assignment status'unu güncelle
  const { data: allItemsRow } = await admin
    .from("order_items")
    .select("proof_status")
    .eq("order_id", order.id);
  type StatusRow = { proof_status: string };
  const allItems = (allItemsRow as StatusRow[] | null) ?? [];
  const allApproved =
    allItems.length > 0 &&
    allItems.every((i) => i.proof_status === "partner_approved");
  const anyRejected = allItems.some(
    (i) => i.proof_status === "partner_rejected"
  );
  const anyPending = allItems.some((i) => isPartnerPending(i.proof_status));

  let assignmentTransition: string | null = null;
  if (anyRejected && assignment.status !== "issue") {
    // Bir item reddedildi → assignment issue'ya al, admin loop'a girer
    await admin
      .from("order_assignments")
      .update({
        status: "issue",
        issue_reported_at: new Date().toISOString(),
        issue_category: "partner_rejected",
        issue_description:
          note ?? `${item.title} tasarımı partner tarafından reddedildi`,
      })
      .eq("id", assignment.id);
    assignmentTransition = "issue";

    const { data: partnerRow } = await admin
      .from("fason_partners")
      .select("name")
      .eq("id", partnerId)
      .maybeSingle();
    const partnerName =
      (partnerRow as { name?: string } | null)?.name ?? "Partner";
    const issueDesc =
      note ?? `${item.title} tasarımı partner tarafından reddedildi`;
    const adminEmails = getAdminNotificationEmails();

    for (const to of adminEmails) {
      await enqueueMail({
        templateKey: "admin_fason_status",
        to,
        category: "admin",
        targetType: "assignment",
        targetId: assignment.id,
        payload: {
          order_id: order.id,
          fason_name: partnerName,
          action: "issue",
          action_label: "Tasarım reddetti",
          issue: issueDesc,
        },
        idempotencyKey: `admin_fason:reject:${assignment.id}:${itemId}:${to}`,
        subject: `Fason güncelleme — ${order.id}: Tasarım reddetti`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: itemId,
      new_proof_status: newProofStatus,
    },
    assignment_transition: assignmentTransition,
    summary: {
      total: allItems.length,
      approved: allItems.filter((i) => i.proof_status === "partner_approved")
        .length,
      rejected: allItems.filter((i) => i.proof_status === "partner_rejected")
        .length,
      pending: allItems.filter((i) => isPartnerPending(i.proof_status)).length,
      all_approved: allApproved,
      any_pending: anyPending,
    },
  });
}
