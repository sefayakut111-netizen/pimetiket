/**
 * PSI mobile baseline — 4 Haziran 2026 manuel ölçüm (PageSpeed Insights).
 * Hub sayfasında referans; canlı ölçüm için PSI / Vercel Speed Insights kullanılır.
 */

export interface PerfBaselineEntry {
  path: string;
  label: string;
  perfScore: number;
  lcpSec: number;
  tbtMs: number;
  cls: number;
  measuredAt: string;
  source: string;
}

export const PERF_BASELINE_MEASURED_AT = "2026-06-04T20:05:00+03:00";
export const PERF_BASELINE_SOURCE =
  "PageSpeed Insights — mobile, Slow 4G, Moto G Power";

export const PERF_BASELINE_ENTRIES: PerfBaselineEntry[] = [
  {
    path: "/",
    label: "Ana sayfa",
    perfScore: 81,
    lcpSec: 4.6,
    tbtMs: 150,
    cls: 0.01,
    measuredAt: PERF_BASELINE_MEASURED_AT,
    source: PERF_BASELINE_SOURCE,
  },
  {
    path: "/sticker",
    label: "Sticker landing",
    perfScore: 82,
    lcpSec: 4.4,
    tbtMs: 170,
    cls: 0.029,
    measuredAt: PERF_BASELINE_MEASURED_AT,
    source: PERF_BASELINE_SOURCE,
  },
  {
    path: "/sticker/yapilandir",
    label: "Konfigüratör",
    perfScore: 73,
    lcpSec: 5.6,
    tbtMs: 310,
    cls: 0,
    measuredAt: PERF_BASELINE_MEASURED_AT,
    source: PERF_BASELINE_SOURCE,
  },
];

export const PERF_TARGETS = {
  lcpSecGreen: 2.5,
  lcpSecYellow: 4.0,
  perfScoreGoal: 85,
} as const;

export function lcpStatus(lcpSec: number): "good" | "needs_improvement" | "poor" {
  if (lcpSec <= PERF_TARGETS.lcpSecGreen) return "good";
  if (lcpSec <= PERF_TARGETS.lcpSecYellow) return "needs_improvement";
  return "poor";
}

export function psiUrlForPath(path: string, siteUrl?: string): string {
  const base = siteUrl ?? "https://pimetiket.com";
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`;
}
