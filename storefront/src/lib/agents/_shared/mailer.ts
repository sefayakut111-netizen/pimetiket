/**
 * Auditor framework için mail dağıtım helper'ı.
 *
 * 3 mail tipi:
 *   1. sendAuditorReport()       — Günlük/haftalık özet rapor (info)
 *   2. sendActionApprovalRequest() — Sefa onay isteme (warning/critical)
 *   3. sendActionAppliedNotification() — Aksiyon uygulandı (audit)
 *
 * Mail policy (Sefa kararı 16 May):
 *   - critical finding'ler → anında mail
 *   - warning'ler → günlük özet
 *   - info → haftalık özet (opsiyonel)
 *
 * Adres: Sefa'nın admin profilindeki email (genelde sefayakut111@gmail.com)
 * From: info@pimetiket.com (Resend doğrulanmış)
 */

import "server-only";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorName,
  type AuditorFinding,
  type PendingActionStatus,
  type ActionResult,
} from "./types";

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

// ============================================================
// Helper: admin mail listesi (env veya profiles tablosu)
// ============================================================

/**
 * Auditor maillerini hangi admin'lere gönder?
 * Şu an: profiles.role IN ('admin', 'staff') olan kullanıcıların e-posta'sı.
 * Override: env'de AUDITOR_NOTIFY_EMAILS varsa onu kullan (CSV).
 */
async function getAdminRecipients(): Promise<string[]> {
  const envOverride = process.env.AUDITOR_NOTIFY_EMAILS;
  if (envOverride) {
    return envOverride
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .in("role", ["admin", "staff"] as never);

  const rows = (data ?? []) as Array<{ email: string | null }>;
  return rows
    .map((r) => r.email)
    .filter((e): e is string => !!e && e.includes("@"));
}

// ============================================================
// 1) Auditor rapor maili
// ============================================================

interface ReportMailParams {
  auditorName: AuditorName;
  runId: string;
  summary: string;
  summaryMd?: string;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
}

export async function sendAuditorReport(
  params: ReportMailParams
): Promise<{ sent: boolean; reason?: string }> {
  if (!isResendConfigured()) return { sent: false, reason: "resend_not_configured" };

  const recipients = await getAdminRecipients();
  if (recipients.length === 0)
    return { sent: false, reason: "no_admin_recipients" };

  const emoji = AUDITOR_EMOJI[params.auditorName];
  const label = AUDITOR_LABELS[params.auditorName];
  const url = `${SITE_URL()}/admin/denetciler/${params.auditorName}?run=${params.runId}`;

  const subject =
    params.criticalCount > 0
      ? `${emoji} ${label} — ${params.criticalCount} KRİTİK bulgu`
      : params.warningCount > 0
        ? `${emoji} ${label} — ${params.warningCount} uyarı`
        : `${emoji} ${label} — temiz (${params.findingsCount} bulgu)`;

  const md = params.summaryMd ?? params.summary;
  const html = renderReportHtml({ ...params, label, emoji, md, url });

  const result = await sendMail({
    to: recipients,
    subject,
    html,
    text: stripHtml(html),
  });

  return { sent: result.ok };
}

// ============================================================
// 2) Aksiyon onay isteme maili (critical)
// ============================================================

interface ApprovalRequestParams {
  auditorName: AuditorName;
  pendingActionId: string;
  title: string;
  description: string;
  severity: "warning" | "critical";
}

export async function sendActionApprovalRequest(
  params: ApprovalRequestParams
): Promise<{ sent: boolean; reason?: string }> {
  if (!isResendConfigured()) return { sent: false, reason: "resend_not_configured" };

  const recipients = await getAdminRecipients();
  if (recipients.length === 0)
    return { sent: false, reason: "no_admin_recipients" };

  const emoji = AUDITOR_EMOJI[params.auditorName];
  const label = AUDITOR_LABELS[params.auditorName];
  const url = `${SITE_URL()}/admin/denetciler/bekleyen#${params.pendingActionId}`;

  const severityLabel =
    params.severity === "critical" ? "🔴 KRİTİK" : "🟡 UYARI";

  const subject = `${emoji} ${severityLabel} — ${params.title}`;

  const html = `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      ${emoji} ${label} · Onay Bekliyor
    </div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0a1928;font-weight:600;line-height:1.3;">
      ${escapeHtml(params.title)}
    </h1>
    <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 24px;">
      ${escapeHtml(params.description)}
    </p>
    <div style="background:${params.severity === "critical" ? "#fee2e2" : "#fef3c7"};border-radius:8px;padding:12px 16px;font-size:13px;color:${params.severity === "critical" ? "#991b1b" : "#92400e"};margin-bottom:24px;">
      <strong>${severityLabel}</strong> · Aksiyon Sefa onayı bekliyor. Onaylamadan otomatik uygulama YOK.
    </div>
    <a href="${url}" style="display:inline-block;background:#ed4d3c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:14px;">
      Onay panelinde aç →
    </a>
    <p style="font-size:11.5px;color:#94a3b8;margin:24px 0 0;line-height:1.5;">
      Bu mail Pim Etiket denetçi agent sisteminden geliyor.
      İptal için /admin/ayarlar'dan bildirimleri kapatabilirsin.
    </p>
  </div>
</div>`.trim();

  const result = await sendMail({
    to: recipients,
    subject,
    html,
    text: stripHtml(html),
  });

  return { sent: result.ok };
}

// ============================================================
// 3) Aksiyon uygulandı bildirimi
// ============================================================

interface AppliedNotificationParams {
  auditorName: AuditorName;
  pendingActionId: string;
  title: string;
  result: ActionResult;
  affectedRows?: number;
  error?: string;
}

export async function sendActionAppliedNotification(
  params: AppliedNotificationParams
): Promise<{ sent: boolean; reason?: string }> {
  if (!isResendConfigured()) return { sent: false, reason: "resend_not_configured" };

  const recipients = await getAdminRecipients();
  if (recipients.length === 0)
    return { sent: false, reason: "no_admin_recipients" };

  const emoji = AUDITOR_EMOJI[params.auditorName];
  const label = AUDITOR_LABELS[params.auditorName];

  const resultEmoji =
    params.result === "success" ? "✅" : params.result === "partial" ? "⚠️" : "❌";

  const subject = `${resultEmoji} ${emoji} ${label} — Aksiyon uygulandı: ${params.title}`;

  const html = `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      ${emoji} ${label} · Aksiyon Uygulandı
    </div>
    <h1 style="margin:0 0 12px;font-size:20px;color:#0a1928;font-weight:600;">
      ${resultEmoji} ${escapeHtml(params.title)}
    </h1>
    ${
      params.affectedRows != null
        ? `<p style="font-size:13px;color:#4b5563;margin:0 0 8px;">Etkilenen kayıt: <strong>${params.affectedRows}</strong></p>`
        : ""
    }
    ${
      params.error
        ? `<div style="background:#fee2e2;border-radius:8px;padding:12px 16px;font-size:13px;color:#991b1b;margin-top:16px;">
            <strong>Hata:</strong> ${escapeHtml(params.error)}
          </div>`
        : ""
    }
    <p style="font-size:11.5px;color:#94a3b8;margin:24px 0 0;">
      Detay: /admin/denetciler
    </p>
  </div>
</div>`.trim();

  const result = await sendMail({
    to: recipients,
    subject,
    html,
    text: stripHtml(html),
  });

  return { sent: result.ok };
}

// ============================================================
// Utility
// ============================================================

function renderReportHtml(opts: {
  label: string;
  emoji: string;
  md: string;
  url: string;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
}): string {
  return `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      ${opts.emoji} ${opts.label} Raporu
    </div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0a1928;font-weight:600;line-height:1.3;">
      ${escapeHtml(opts.md.split("\n")[0])}
    </h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
      ${opts.criticalCount > 0 ? `<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:9999px;font-size:12px;font-weight:600;">${opts.criticalCount} kritik</span>` : ""}
      ${opts.warningCount > 0 ? `<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:9999px;font-size:12px;font-weight:600;">${opts.warningCount} uyarı</span>` : ""}
      <span style="background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:9999px;font-size:12px;font-weight:600;">${opts.findingsCount} toplam bulgu</span>
    </div>
    <pre style="background:#f8fafc;padding:16px;border-radius:8px;font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.5;color:#334155;white-space:pre-wrap;word-wrap:break-word;margin:0 0 24px;">${escapeHtml(opts.md.split("\n").slice(1).join("\n"))}</pre>
    <a href="${opts.url}" style="display:inline-block;background:#0a1928;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9999px;font-weight:600;font-size:13px;">
      Detayda incele →
    </a>
  </div>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Lint: PendingActionStatus tipi şu an kullanılmıyor ama mail iletisi
// gelecekte status filter için lazım olabilir → re-export
export type { PendingActionStatus };
