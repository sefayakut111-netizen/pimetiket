/**
 * TrendSparkline — Auditor run trend grafiği (Adım 8 polish)
 *
 * Recharts veya başka chart lib KULLANMAZ — inline SVG bar chart.
 * Hedef: hafif, brand-faithful (mercan), responsive.
 *
 * Props:
 *   - data: AuditorRunRow[] (son 30 gün, eski→yeni sıralı)
 *   - metric: "findings" | "critical" | "duration" | "ai_cost"
 *
 * Bar: her run bir bar. Hover'da tooltip (basit title attribute).
 */

"use client";

import { cn } from "@/lib/cn";
import type { AuditorRunRow } from "@/lib/agents/_shared/types";

type TrendMetric = "findings" | "critical" | "warning" | "duration";

interface TrendSparklineProps {
  data: AuditorRunRow[];
  metric: TrendMetric;
  label: string;
  className?: string;
}

const COLORS: Record<TrendMetric, string> = {
  findings: "#ed4d3c",  // pim-mercan
  critical: "#dc2626",  // kirmizi
  warning: "#ca8a04",   // saman-koyu
  duration: "#64748b",  // gri-700
};

function extractValue(run: AuditorRunRow, metric: TrendMetric): number {
  switch (metric) {
    case "findings":
      return run.findings_count ?? 0;
    case "critical":
      return run.critical_count ?? 0;
    case "warning":
      return run.warning_count ?? 0;
    case "duration":
      return Math.round((run.duration_ms ?? 0) / 1000); // saniye
  }
}

function formatTooltip(run: AuditorRunRow, metric: TrendMetric): string {
  const date = new Date(run.started_at).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const value = extractValue(run, metric);
  const suffix =
    metric === "duration"
      ? "s"
      : metric === "findings"
        ? " bulgu"
        : metric === "critical"
          ? " kritik"
          : " uyarı";
  return `${date}: ${value}${suffix}`;
}

export function TrendSparkline({
  data,
  metric,
  label,
  className,
}: TrendSparklineProps) {
  if (data.length === 0) {
    return (
      <div className={cn("text-center py-8 text-gri-500 text-[12.5px]", className)}>
        Henüz geçmiş veri yok
      </div>
    );
  }

  // Eski → yeni sıralı (DB descending döner, ters çevir)
  const sorted = [...data].reverse();

  const values = sorted.map((r) => extractValue(r, metric));
  const max = Math.max(...values, 1); // sıfıra bölünme önleme
  const total = values.reduce((s, v) => s + v, 0);
  const avg = total / values.length;

  const color = COLORS[metric];

  const barWidth = 8;
  const gap = 2;
  const height = 56;
  const width = sorted.length * (barWidth + gap);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end justify-between text-[11.5px]">
        <span className="font-semibold text-lacivert">{label}</span>
        <span className="text-gri-500">
          Toplam: <strong className="text-lacivert">{total}</strong> · Ort{" "}
          <strong className="text-lacivert">{avg.toFixed(1)}</strong>
        </span>
      </div>
      <div className="overflow-x-auto -mx-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-1"
          preserveAspectRatio="xMaxYMax meet"
          role="img"
          aria-label={`${label} son ${sorted.length} run trendi`}
        >
          {sorted.map((run, i) => {
            const value = values[i];
            const barHeight = max > 0 ? (value / max) * (height - 8) : 0;
            const x = i * (barWidth + gap);
            const y = height - barHeight;
            return (
              <g key={run.id}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight || 1}
                  rx={1.5}
                  fill={value === 0 ? "#e5e7eb" : color}
                  opacity={value === 0 ? 0.5 : 1}
                >
                  <title>{formatTooltip(run, metric)}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
