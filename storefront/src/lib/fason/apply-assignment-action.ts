/**
 * Ortak fason assignment durum güncelleme mantığı.
 * Token form (/api/fason/update) ve partner panel (/api/partner/orders/[id]/status) tarafından kullanılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logOrderEvent } from "@/lib/order-events-server";
import { transitionOrderStatus } from "@/lib/db/transition-order-status";
import { enqueueMail } from "@/lib/mail/enqueue";

export type FasonAction =
  | "acknowledge"
  | "in_production"
  | "ready"
  | "shipped"
  | "issue";

export const VALID_FASON_ACTIONS: FasonAction[] = [
  "acknowledge",
  "in_production",
  "ready",
  "shipped",
  "issue",
];

const ACTION_TO_STATUS: Record<FasonAction, string> = {
  acknowledge: "acknowledged",
  in_production: "in_production",
  ready: "ready",
  shipped: "shipped",
  issue: "issue",
};

/** Geçerli assignment status geçişleri (FSM) */
const ALLOWED_FROM_STATUS: Record<FasonAction, readonly string[]> = {
  acknowledge: ["assigned", "sent"],
  in_production: ["acknowledged"],
  ready: ["in_production"],
  shipped: ["ready"],
  issue: ["assigned", "sent", "acknowledged", "in_production", "ready"],
};

const ACTION_TO_EVENT: Record<FasonAction, string> = {
  acknowledge: "fason_acknowledged",
  in_production: "fason_in_production",
  ready: "fason_ready",
  shipped: "fason_shipped",
  issue: "fason_issue_reported",
};

const ADMIN_FASON_ACTION_LABELS: Record<FasonAction, string> = {
  acknowledge: "İşi aldı (onayladı)",
  in_production: "Üretime başladı",
  ready: "Üretim tamamlandı (hazır)",
  shipped: "Kargoya verdi",
  issue: "⚠️ Sorun bildirdi",
};

function getAdminNotificationEmails(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const ACTION_TIMESTAMP_COLUMN: Record<FasonAction, string> = {
  acknowledge: "acknowledged_at",
  in_production: "in_production_at",
  ready: "ready_at",
  shipped: "shipped_at",
  issue: "issue_reported_at",
};

export interface FasonActionInput {
  issue?: {
    category?: unknown;
    description?: unknown;
    photoStoragePath?: unknown;
  };
  tracking?: {
    company?: unknown;
    number?: unknown;
    url?: unknown;
  };
}

export type BuildPayloadResult =
  | { ok: true; payload: Record<string, unknown>; newStatus: string }
  | { ok: false; error: string; status: number };

export function buildAssignmentUpdatePayload(
  action: FasonAction,
  body: FasonActionInput
): BuildPayloadResult {
  const timestampCol = ACTION_TIMESTAMP_COLUMN[action];
  const newStatus = ACTION_TO_STATUS[action];
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    [timestampCol]: new Date().toISOString(),
  };

  if (action === "issue") {
    const cat = body.issue?.category;
    const desc = body.issue?.description;
    const photo = body.issue?.photoStoragePath;
    if (
      typeof cat !== "string" ||
      !["dosya", "malzeme", "sure", "diger"].includes(cat)
    ) {
      return {
        ok: false,
        error: "Sorun kategorisi geçersiz",
        status: 400,
      };
    }
    if (typeof desc !== "string" || desc.trim().length < 5) {
      return {
        ok: false,
        error: "Açıklama en az 5 karakter olmalı",
        status: 400,
      };
    }
    updatePayload.issue_category = cat;
    updatePayload.issue_description = desc.trim().slice(0, 2000);
    if (typeof photo === "string") {
      updatePayload.issue_photo_path = photo;
    }
  }

  if (action === "shipped") {
    const company = body.tracking?.company;
    const number = body.tracking?.number;
    const trackUrl = body.tracking?.url;
    if (typeof company !== "string" || typeof number !== "string") {
      return {
        ok: false,
        error: "Kargo firması ve takip no zorunlu",
        status: 400,
      };
    }
    const companyTrim = company.trim();
    const numberTrim = number.trim();
    if (companyTrim.length === 0 || companyTrim.length > 64) {
      return {
        ok: false,
        error: "Kargo firması 1-64 karakter olmalı",
        status: 400,
      };
    }
    if (numberTrim.length === 0 || numberTrim.length > 64) {
      return {
        ok: false,
        error: "Takip numarası 1-64 karakter olmalı",
        status: 400,
      };
    }
    updatePayload.tracking_company = companyTrim;
    updatePayload.tracking_number = numberTrim;

    if (typeof trackUrl === "string" && trackUrl.trim().length > 0) {
      const raw = trackUrl.trim();
      if (raw.length > 512) {
        return {
          ok: false,
          error: "Takip linki çok uzun (max 512)",
          status: 400,
        };
      }
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:") {
          return {
            ok: false,
            error: "Takip linki sadece https:// olabilir",
            status: 400,
          };
        }
        updatePayload.tracking_url = parsed.toString();
      } catch {
        return {
          ok: false,
          error: "Takip linki geçerli bir URL değil",
          status: 400,
        };
      }
    }
  }

  return { ok: true, payload: updatePayload, newStatus };
}

export interface ApplyAssignmentActionOptions {
  assignmentId: string;
  orderId: string;
  action: FasonAction;
  body: FasonActionInput;
  actorRole?: "fason" | "system";
  via?: string;
  accessLog?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}

export type ApplyAssignmentActionResult =
  | { ok: true; newStatus: string }
  | { ok: false; error: string; status: number };

export async function applyAssignmentAction(
  admin: SupabaseClient,
  opts: ApplyAssignmentActionOptions
): Promise<ApplyAssignmentActionResult> {
  const built = buildAssignmentUpdatePayload(opts.action, opts.body);
  if (!built.ok) {
    return { ok: false, error: built.error, status: built.status };
  }

  const { data: currentRow, error: readErr } = await admin
    .from("order_assignments")
    .select("status")
    .eq("id", opts.assignmentId)
    .maybeSingle();

  if (readErr || !currentRow) {
    return { ok: false, error: "Atama bulunamadı", status: 404 };
  }

  const currentStatus = (currentRow as { status: string }).status;
  const allowedFrom = ALLOWED_FROM_STATUS[opts.action];
  if (!allowedFrom.includes(currentStatus)) {
    return {
      ok: false,
      error: `Geçersiz durum geçişi: ${currentStatus} → ${built.newStatus}`,
      status: 409,
    };
  }

  const { error: updateErr } = await admin
    .from("order_assignments")
    .update(built.payload)
    .eq("id", opts.assignmentId);

  if (updateErr) {
    console.error("[apply-assignment-action]", updateErr);
    return { ok: false, error: "Güncelleme başarısız", status: 500 };
  }

  if (opts.accessLog) {
    await admin.from("fason_link_access_log").insert({
      assignment_id: opts.assignmentId,
      ip_address: opts.accessLog.ipAddress ?? null,
      user_agent: opts.accessLog.userAgent?.slice(0, 500) ?? null,
      action: "status_update",
      success: true,
    });
  }

  const actorRole = opts.actorRole ?? "fason";
  await logOrderEvent(admin, {
    orderId: opts.orderId,
    eventType: ACTION_TO_EVENT[opts.action],
    actorRole,
    summary: `Fason durum güncelledi: ${opts.action}`,
    detail: {
      assignment_id: opts.assignmentId,
      action: opts.action,
      via: opts.via ?? "fason_form",
      ...(opts.action === "issue" && {
        category: built.payload.issue_category,
        description: built.payload.issue_description,
      }),
      ...(opts.action === "shipped" && {
        tracking_company: built.payload.tracking_company,
        tracking_number: built.payload.tracking_number,
      }),
    },
  });

  if (opts.action === "shipped") {
    await transitionOrderStatus(admin, {
      orderId: opts.orderId,
      to: "shipped",
      mode: "forward",
      actorRole: "fason",
      eventType: "shipped",
      summary: "Sipariş kargoya verildi",
      detail: { via: opts.via ?? "fason_form", assignment_id: opts.assignmentId },
    });
  }

  const adminEmails = getAdminNotificationEmails();
  if (adminEmails.length > 0) {
    const { data: asgRow } = await admin
      .from("order_assignments")
      .select("fason_partner_id")
      .eq("id", opts.assignmentId)
      .maybeSingle();

    let partnerName = "Partner";
    if (asgRow) {
      const { data: partnerRow } = await admin
        .from("fason_partners")
        .select("name")
        .eq("id", (asgRow as { fason_partner_id: string }).fason_partner_id)
        .maybeSingle();
      partnerName =
        (partnerRow as { name?: string } | null)?.name ?? partnerName;
    }

    const actionLabel = ADMIN_FASON_ACTION_LABELS[opts.action] ?? opts.action;
    const issueDescription =
      opts.action === "issue" &&
      typeof opts.body.issue?.description === "string"
        ? opts.body.issue.description.trim().slice(0, 500)
        : undefined;

    for (const to of adminEmails) {
      await enqueueMail({
        templateKey: "admin_fason_status",
        to,
        category: "admin",
        targetType: "assignment",
        targetId: opts.assignmentId,
        payload: {
          order_id: opts.orderId,
          fason_name: partnerName,
          action: opts.action,
          action_label: actionLabel,
          ...(issueDescription ? { issue: issueDescription } : {}),
        },
        idempotencyKey: `admin_fason:${opts.assignmentId}:${opts.action}:${to}`,
        subject: `Fason güncelleme — ${opts.orderId}: ${actionLabel}`,
      });
    }
  }

  return { ok: true, newStatus: built.newStatus };
}
