/**
 * Aksiyon: notify_sefa — Önemli bir konuda Sefa'ya mail at.
 *
 * Payload:
 *   { subject: string, message: string, urgency?: "info" | "warning" | "critical" }
 *
 * Bu aksiyon "fiziksel" bir değişiklik yapmıyor — sadece bilgilendirme.
 * Sefa onayladığında mail gider. Onay sistemi sebebi: hesap güvenliği
 * vs ya da KVKK sorun bildirimi gibi durumlarda Sefa'nın "bu konuda
 * resmi mail gitsin" demesi gereken durumlar.
 */

import type { ActionHandler } from "../_shared/proposal";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";

interface NotifyPayload {
  subject: string;
  message: string;
  urgency?: "info" | "warning" | "critical";
}

const URGENCY_EMOJI = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
} as const;

const notifySefa: ActionHandler = async ({ admin, payload }) => {
  const {
    subject,
    message,
    urgency = "info",
  } = payload as unknown as NotifyPayload;

  if (!subject || !message) {
    return {
      result: "failed",
      error: "Invalid payload: 'subject' and 'message' required",
    };
  }

  if (!isResendConfigured()) {
    return {
      result: "partial",
      error: "Resend not configured — mail SKIPPED, audit only",
    };
  }

  // Recipient: env override veya profiles admin'leri
  const envOverride = process.env.AUDITOR_NOTIFY_EMAILS;
  let recipients: string[] = [];

  if (envOverride) {
    recipients = envOverride
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
  } else {
    const { data } = await admin
      .from("profiles")
      .select("email")
      .in("role", ["admin", "staff"] as never);
    const rows = (data ?? []) as Array<{ email: string | null }>;
    recipients = rows
      .map((r) => r.email)
      .filter((e): e is string => !!e && e.includes("@"));
  }

  if (recipients.length === 0) {
    return {
      result: "failed",
      error: "No admin recipients configured",
    };
  }

  const emoji = URGENCY_EMOJI[urgency];
  const finalSubject = `${emoji} ${subject}`;

  const html = `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;background:#f8fafc;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      Pim Etiket Denetçi Bildirimi · ${urgency.toUpperCase()}
    </div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0a1928;font-weight:600;line-height:1.3;">
      ${emoji} ${escapeHtml(subject)}
    </h1>
    <div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;">
${escapeHtml(message)}
    </div>
    <p style="font-size:11.5px;color:#94a3b8;margin:24px 0 0;line-height:1.5;">
      Detay: /admin/denetciler
    </p>
  </div>
</div>`.trim();

  const result = await sendMail({
    to: recipients,
    subject: finalSubject,
    html,
    text: `${emoji} ${subject}\n\n${message}\n\n— Pim Etiket Denetçi Sistemi`,
  });

  return {
    result: result.ok ? "success" : "failed",
    affectedRows: result.ok ? recipients.length : 0,
    externalCall: {
      provider: "resend",
      recipients,
      subject: finalSubject,
      messageId: result.ok ? (result as { messageId?: string }).messageId : null,
    },
    error: result.ok ? undefined : "mail_send_failed",
  };
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default notifySefa;
