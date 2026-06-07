/**
 * Admin kritik PARA/güvenlik uyarıları — ADMIN_NOTIFICATION_EMAIL listesine mail.
 */

import "server-only";

import { enqueueMail } from "@/lib/mail/enqueue";

function adminEmails(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function notifyAdminCriticalAlert(params: {
  alertKey: string;
  subject: string;
  title: string;
  body: string;
  targetType?: "order" | "user" | "cart";
  targetId?: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const emails = adminEmails();
  if (emails.length === 0) return;

  for (const to of emails) {
    await enqueueMail({
      to,
      templateKey: "admin_critical_alert",
      category: "admin",
      targetType: params.targetType,
      targetId: params.targetId,
      subject: params.subject,
      idempotencyKey: `${params.alertKey}:${to}`,
      payload: {
        title: params.title,
        body: params.body,
        ...params.extra,
      },
    });
  }
}
