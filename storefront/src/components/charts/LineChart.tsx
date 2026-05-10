"use client";

/**
 * LineChart — inline SVG sparkline / area chart.
 * Hafif, dependency-free, mobil dostu. Recharts gerekmiyor.
 *
 * Kullanım:
 *   <LineChart points={[{ x: "1 May", y: 1200 }, ...]} height={120} />
 */

import { useMemo } from "react";

export interface LinePoint {
  x: string;
  y: number;
}

interface LineChartProps {
  points: LinePoint[];
  height?: number;
  /** Tailwind text class — line stroke + area fill (opacity 0.15) */
  color?: string;
  /** y ekseni alt eksen 0'dan mı başlasın */
  zeroBased?: boolean;
  /** Tooltip için y formatter */
  formatY?: (n: number) => string;
  /** "Veri yok" mesajı */
  emptyLabel?: string;
}

export function LineChart({
  points,
  height = 120,
  color = "text-pim-mercan",
  zeroBased = true,
  formatY = (n) => n.toString(),
  emptyLabel = "Veri yok",
}: LineChartProps) {
  const data = useMemo(() => {
    if (points.length === 0) return null;
    const ys = points.map((p) => p.y);
    const minY = zeroBased ? 0 : Math.min(...ys);
    const maxY = Math.max(...ys, 1);
    const padded = maxY - minY < 1 ? minY + 1 : maxY;
    return { minY, maxY: padded, ys };
  }, [points, zeroBased]);

  if (!data || points.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-[12.5px] text-gri-500"
      >
        {emptyLabel}
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const range = data.maxY - data.minY || 1;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xy = points.map((p, i) => {
    const x = padX + i * step;
    const y = padY + innerH - ((p.y - data.minY) / range) * innerH;
    return { x, y, raw: p };
  });

  const linePath = xy
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${xy[xy.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${xy[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        className={color}
        role="img"
        aria-label={`Çizgi grafiği — ${points.length} veri noktası`}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            y1={padY + innerH * t}
            x2={W - padX}
            y2={padY + innerH * t}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}
        {/* Area */}
        <path
          d={areaPath}
          fill="currentColor"
          fillOpacity="0.12"
        />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {xy.map((p, i) => (
          <g key={i}>
            <title>
              {p.raw.x}: {formatY(p.raw.y)}
            </title>
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill="white"
              stroke="currentColor"
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>
      {/* X labels — first / mid / last */}
      <div className="flex justify-between text-[10.5px] text-gri-500 mt-1.5 px-1 tabular-nums">
        <span>{points[0].x}</span>
        {points.length > 2 && (
          <span>{points[Math.floor(points.length / 2)].x}</span>
        )}
        <span>{points[points.length - 1].x}</span>
      </div>
    </div>
  );
}
