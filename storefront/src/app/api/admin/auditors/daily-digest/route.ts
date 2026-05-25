/**
 * POST /api/admin/auditors/daily-digest
 *
 * Sefa için manuel daily digest tetikleyici — cron beklemeden
 * "şimdi günlük rapor mailini at" diyebilir.
 *
 * Cron endpoint /api/cron/auditors/daily-digest aynı işi yapar ama
 * Bearer auth gerektirir. Bu endpoint admin session auth ile çalışır.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  AUDITOR_NAMES,
  type AuditorName,
} from "@/lib/agents/_shared/types";

interface LatestRunRow {
  auditor_name: string;
  latest_run_id: string | null;
  started_at: string | null;
  status: string | null;
  findings_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: string | null;
}

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600_000);
  if (diffH < 24) return `${diffH} sa önce`;
  return `${Math.floor(diffH / 24)} gün önce`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST() {
  const auth = await assertPermission("auditors", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "RESEND_API_KEY env'de yok",
    });
  }

  const admin = createAdminClient();

  const { data } = await admin
    .from("v_auditor_latest_runs")
    .select(
      "auditor_name, latest_run_id, started_at, status, findings_count, critical_count, warning_count, info_count, summary"
    );

  const rows = (data ?? []) as unknown as LatestRunRow[];
  const runMap = new Map(rows.map((r) => [r.auditor_name, r]));

  const summaries = AUDITOR_NAMES.map((name) => runMap.get(name));
  const totalCritical = summaries.reduce(
    (s, a) => s + (a?.critical_count ?? 0),
    0
  );
  const totalWarning = summaries.reduce(
    (s, a) => s + (a?.warning_count ?? 0),
    0
  );
  const neverRun = summaries.filter((a) => !a?.latest_run_id).length;

  const { count: pendingCount } = await admin
    .from("auditor_pending_actions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const subject =
    totalCritical > 0
      ? `🔴 [MANUEL] Pim Etiket Brifingi — ${totalCritical} KRİTİK`
      : totalWarning > 0
        ? `🟡 [MANUEL] Pim Etiket Brifingi — ${totalWarning} uyarı`
        : `✅ [MANUEL] Pim Etiket Brifingi — temiz`;

  const recipients = (process.env.AUDITOR_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

  const tableRows = AUDITOR_NAMES.map((name) => {
    const r = runMap.get(name);
    const emoji = AUDITOR_EMOJI[name as AuditorName];
    const label = AUDITOR_LABELS[name as AuditorName];
    const status = !r?.latest_run_id
      ? `<span style="color:#94a3b8">— henüz çalışmadı</span>`
      : (r.critical_count ?? 0) > 0
        ? `<span style="color:#dc2626;font-weight:600">${r.critical_count} kritik</span>`
        : (r.warning_count ?? 0) > 0
          ? `<span style="color:#ca8a04;font-weight:600">${r.warning_count} uyarı</span>`
          : `<span style="color:#16a34a">✓ temiz</span>`;
    const time = fmtTime(r?.started_at ?? null);

    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:18px;margin-right:6px;">${emoji}</span>
        <strong style="color:#0a1928">${escapeHtml(label)}</strong>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12.5px;color:#475569;">
        ${status}<br>
        <span style="font-size:11px;color:#94a3b8">${time}</span>
      </td>
    </tr>`;
  }).join("");

  const html = `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      🦉 Pim Etiket — Manuel Brifing
    </div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0a1928;font-weight:600;">
      ${totalCritical > 0 ? `🔴 ${totalCritical} kritik` : totalWarning > 0 ? `🟡 ${totalWarning} uyarı` : "✅ Temiz"}
      ${neverRun > 0 ? `<span style="color:#94a3b8;font-weight:400;font-size:14px"> · ${neverRun} agent çalışmadı</span>` : ""}
    </h1>
    ${(pendingCount ?? 0) > 0 ? `<div style="background:#fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px;color:#92400e;font-size:13px;font-weight:600;">🔔 ${pendingCount} aksiyon onay bekliyor · <a href="${SITE_URL()}/admin/denetciler/bekleyen" style="color:inherit">İncele →</a></div>` : ""}
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">${tableRows}</table>
    <a href="${SITE_URL()}/admin/denetciler" style="display:inline-block;background:#ed4d3c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9999px;font-weight:600;font-size:13px;">Dashboard'a git →</a>
  </div>
</div>`.trim();

  const result = await sendMail({
    to: recipients,
    subject,
    html,
    text: subject,
  });

  return NextResponse.json({
    ok: result.ok,
    sent: result.ok ? recipients : [],
    totalCritical,
    totalWarning,
    neverRun,
    pendingCount,
  });
}
