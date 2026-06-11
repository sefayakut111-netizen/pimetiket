/**
 * Teknik Performans & Otomasyon hub — sunucu tarafı özet veri toplayıcı.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDITOR_NAMES, type AuditorName, type RunStatus } from "@/lib/agents/_shared/types";
import { summarizeCronHealth } from "@/lib/cron-health";
import { CRON_REGISTRY } from "@/lib/cron-registry";
import { isResendConfigured } from "@/lib/mail/resend";
import { IS_ARCHIVE_DRY_RUN } from "@/lib/storage/r2-client";
import { IS_YURTICI_DRY_RUN } from "@/lib/shipping/yurtici-api";
import {
  PERF_BASELINE_ENTRIES,
  PERF_BASELINE_MEASURED_AT,
  PERF_TARGETS,
  psiUrlForPath,
} from "@/lib/perf-baseline";
import { getSiteUrl } from "@/lib/site-url";

export type AutomationFlagStatus = "active" | "partial" | "inactive" | "cancelled";

export interface AutomationFlag {
  id: string;
  label: string;
  status: AutomationFlagStatus;
  detail: string;
  activationStep?: string;
  href?: string;
}

export interface AuditorRunSnapshot {
  auditorName: AuditorName;
  status: RunStatus | null;
  startedAt: string | null;
  criticalCount: number;
  warningCount: number;
  summary: string | null;
}

export interface SystemOverviewPayload {
  ok: true;
  generatedAt: string;
  kpis: {
    cronTotal: number;
    cronErrors: number;
    cronFailures24h: number;
    auditorsPendingCritical: number;
    auditorsPendingTotal: number;
    queueCritical: number;
    mailPending: number;
    mailStubMode: boolean;
    welcomeMailPending: number;
  };
  auditors: {
    appHealth: AuditorRunSnapshot | null;
    seo: AuditorRunSnapshot | null;
  };
  automation: AutomationFlag[];
  cwv: {
    baselineMeasuredAt: string;
    targets: typeof PERF_TARGETS;
    entries: typeof PERF_BASELINE_ENTRIES;
    vercelSpeedInsightsUrl: string;
    psiUrls: Array<{ path: string; label: string; url: string }>;
  };
  env: Array<{ key: string; configured: boolean; label: string }>;
  quickLinks: Array<{ href: string; label: string }>;
}

interface LatestRunRow {
  auditor_name: string;
  status: RunStatus | null;
  started_at: string | null;
  critical_count: number;
  warning_count: number;
  summary: string | null;
}

interface PendingCountRow {
  critical_pending: number | string;
  total_pending: number | string;
}

export async function buildSystemOverview(
  admin: SupabaseClient
): Promise<SystemOverviewPayload> {
  const siteUrl = getSiteUrl();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const cronSummary = await summarizeCronHealth(admin).catch(() => ({
    total: CRON_REGISTRY.length,
    healthy: 0,
    error: 0,
    failures: [] as Array<{ name: string; label: string; error?: string }>,
  }));

  const { count: cronFailures24h } = await admin
    .from("cron_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "error")
    .gte("started_at", since24h);

  const { data: pendingRow } = await admin
    .from("v_auditor_pending_count")
    .select("critical_pending, total_pending")
    .maybeSingle();

  const pending = (pendingRow ?? {}) as PendingCountRow;
  const auditorsPendingCritical = Number(pending.critical_pending ?? 0);
  const auditorsPendingTotal = Number(pending.total_pending ?? 0);

  const { data: runsData } = await admin
    .from("v_auditor_latest_runs")
    .select(
      "auditor_name, status, started_at, critical_count, warning_count, summary"
    )
    .in("auditor_name", ["app_health", "seo"]);

  const runMap = new Map(
    ((runsData ?? []) as LatestRunRow[]).map((r) => [r.auditor_name, r])
  );

  function snapshot(name: AuditorName): AuditorRunSnapshot | null {
    const row = runMap.get(name);
    if (!row) return null;
    return {
      auditorName: name,
      status: row.status,
      startedAt: row.started_at,
      criticalCount: Number(row.critical_count ?? 0),
      warningCount: Number(row.warning_count ?? 0),
      summary: row.summary,
    };
  }

  const { count: mailPending } = await admin
    .from("fason_mail_outbox")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "sending"]);

  const { count: welcomeMailPending } = await admin
    .from("email_subscribers")
    .select("id", { count: "exact", head: true })
    .is("welcome_sent_at", null)
    .eq("subscribed", true)
    .is("deleted_at", null);

  const { data: settings } = await admin
    .from("site_settings")
    .select("partner_auto_assign_enabled")
    .eq("id", 1)
    .maybeSingle();

  const partnerAutoAssign = Boolean(
    (settings as { partner_auto_assign_enabled?: boolean } | null)
      ?.partner_auto_assign_enabled
  );

  const mailStubMode = !isResendConfigured();

  const queueCritical = await countQueueCritical(admin);

  const automation = buildAutomationFlags({
    mailStubMode,
    partnerAutoAssign,
    welcomeMailPending: welcomeMailPending ?? 0,
    mailPending: mailPending ?? 0,
  });

  const envChecks = [
    {
      key: "RESEND_API_KEY",
      configured: isResendConfigured(),
      label: "Resend e-posta",
    },
    {
      key: "GA4_PROPERTY_ID",
      configured: Boolean(process.env.GA4_PROPERTY_ID),
      label: "GA4 Data API",
    },
    {
      key: "GSC_SERVICE_ACCOUNT",
      configured: Boolean(process.env.GSC_CLIENT_EMAIL),
      label: "Search Console",
    },
    {
      key: "YURTICI_USERNAME",
      configured: !IS_YURTICI_DRY_RUN,
      label: "Yurtiçi Kargo API",
    },
    {
      key: "NEXT_PUBLIC_SENTRY_DSN",
      configured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      label: "Sentry",
    },
  ];

  const vercelTeam =
    process.env.VERCEL_TEAM_SLUG ?? process.env.VERCEL_ORG_ID ?? "";
  const vercelProject = process.env.VERCEL_PROJECT_ID ?? "";
  const vercelSpeedInsightsUrl =
    vercelTeam && vercelProject
      ? `https://vercel.com/${vercelTeam}/${vercelProject}/speed-insights`
      : "https://vercel.com/dashboard";

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    kpis: {
      cronTotal: cronSummary.total,
      cronErrors: cronSummary.error,
      cronFailures24h: cronFailures24h ?? 0,
      auditorsPendingCritical,
      auditorsPendingTotal,
      queueCritical,
      mailPending: mailPending ?? 0,
      mailStubMode,
      welcomeMailPending: welcomeMailPending ?? 0,
    },
    auditors: {
      appHealth: snapshot("app_health"),
      seo: snapshot("seo"),
    },
    automation,
    cwv: {
      baselineMeasuredAt: PERF_BASELINE_MEASURED_AT,
      targets: PERF_TARGETS,
      entries: PERF_BASELINE_ENTRIES,
      vercelSpeedInsightsUrl,
      psiUrls: PERF_BASELINE_ENTRIES.map((e) => ({
        path: e.path,
        label: e.label,
        url: psiUrlForPath(e.path, siteUrl),
      })),
    },
    env: envChecks,
    quickLinks: [
      { href: "/admin/sistem/cronlar", label: "Cron izleme" },
      { href: "/admin/denetciler", label: "Denetçiler" },
      { href: "/admin/kuyruk", label: "Operasyon kuyruğu" },
      { href: "/admin/mail-health", label: "Mail sağlığı" },
      { href: "/admin/trafik", label: "Trafik (GA4)" },
      { href: "/admin/ayarlar", label: "Ayarlar" },
    ],
  };
}

function buildAutomationFlags(ctx: {
  mailStubMode: boolean;
  partnerAutoAssign: boolean;
  welcomeMailPending: number;
  mailPending: number;
}): AutomationFlag[] {
  const flags: AutomationFlag[] = [
    {
      id: "order_pipeline",
      label: "Sipariş pipeline (QC → bıçak → prova)",
      status: "active",
      detail: "Ödeme sonrası otomatik; circuit-breaker açıkken insan kuyruğu.",
    },
    {
      id: "resend_mail",
      label: "Resend mail outbox",
      status: ctx.mailStubMode ? "partial" : "active",
      detail: ctx.mailStubMode
        ? `Stub mod — ${ctx.mailPending} kuyruk kaydı bekliyor, gönderim yapılmıyor.`
        : "Canlı — process-mail-outbox cron gönderir.",
      activationStep: ctx.mailStubMode
        ? "Resend domain doğrula + Vercel'de RESEND_API_KEY ekle"
        : undefined,
      href: "/admin/mail-health",
    },
    {
      id: "welcome_mail",
      label: "Abone welcome mail",
      status: ctx.mailStubMode ? "inactive" : ctx.welcomeMailPending > 0 ? "partial" : "active",
      detail: ctx.welcomeMailPending > 0
        ? `${ctx.welcomeMailPending} abone welcome mail bekliyor.`
        : "Kuyruk boş veya Resend kapalı.",
      activationStep: ctx.mailStubMode ? "Önce Resend'i aktifleştir (C1)" : undefined,
      href: "/admin/aboneler",
    },
    {
      id: "partner_auto_assign",
      label: "Fason otomatik atama",
      status: ctx.partnerAutoAssign ? "active" : "inactive",
      detail: ctx.partnerAutoAssign
        ? "site_settings.partner_auto_assign_enabled = true"
        : "Varsayılan kapalı — ilk siparişler manuel atama.",
      activationStep: !ctx.partnerAutoAssign
        ? "İlk 5 sipariş manuel atandıktan sonra Ayarlar'dan aç"
        : undefined,
      href: "/admin/ayarlar",
    },
    {
      id: "yurtici_tracking",
      label: "Kargo tracking poll",
      status: IS_YURTICI_DRY_RUN ? "partial" : "active",
      detail: IS_YURTICI_DRY_RUN
        ? "DRY_RUN — sahte tracking event'leri üretiliyor."
        : "Yurtiçi API canlı — poll-shipments cron.",
      activationStep: IS_YURTICI_DRY_RUN
        ? "YURTICI_USERNAME + YURTICI_PASSWORD env (bkz. YURTICI-KARGO-SETUP.md)"
        : undefined,
      href: "/admin/kargo",
    },
    {
      id: "r2_archive",
      label: "R2 cold archive",
      status: IS_ARCHIVE_DRY_RUN ? "partial" : "active",
      detail: IS_ARCHIVE_DRY_RUN
        ? "R2_ARCHIVE_DRY_RUN=true — gerçek arşiv yazılmıyor."
        : "Cold storage transfer aktif.",
      activationStep: IS_ARCHIVE_DRY_RUN
        ? "12 ay retention onayı sonrası R2_ARCHIVE_DRY_RUN=false"
        : undefined,
      href: "/admin/arsiv",
    },
    {
      id: "seo_indexnow",
      label: "IndexNow + SeoAuditor",
      status: "active",
      detail: "Haftalık SEO denetimi + IndexNow cron canlıda.",
      href: "/admin/denetciler/seo",
    },
    {
      id: "instagram_sync",
      label: "Instagram sync",
      status: process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
        ? "active"
        : "inactive",
      detail: process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
        ? "Günlük cron — ana sayfa feed slotları güncellenir."
        : "env bekliyor: INSTAGRAM_ACCESS_TOKEN",
      activationStep: process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
        ? undefined
        : "Meta Developer → long-lived INSTAGRAM_ACCESS_TOKEN",
    },
  ];

  return flags;
}

/** Kritik operasyon kuyruğu — proof SLA + AI QC acil kayıtları. */
async function countQueueCritical(admin: SupabaseClient): Promise<number> {
  const [{ count: proofCritical }, { count: aiQcCount }] = await Promise.all([
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", [
        "proof_pending",
        "proof_generating",
        "proof_validating",
        "operator_print_review",
      ])
      .lte("sla_proof_deadline", new Date().toISOString()),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["human_review_failed", "qc_flagged"]),
  ]);

  return (proofCritical ?? 0) + (aiQcCount ?? 0);
}

/** Auditor listesi doğrulama — tip export. */
export const SYSTEM_OVERVIEW_AUDITORS = AUDITOR_NAMES;
