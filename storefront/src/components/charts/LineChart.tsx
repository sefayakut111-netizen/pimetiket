"use client";

/**
 * LineChart — inline SVG sparkline / area chart.
 * Hafif, dependency-free, mobil dostu. Recharts gerekmiyor.
 */

import { useMemo, useState } from "react";

export interface LinePoint {
  x: string;
  y: number;
}

interface LineChartProps {
  points: LinePoint[];
  height?: number;
  color?: string;
  zeroBased?: boolean;
  formatY?: (n: number) => string;
  emptyLabel?: string;
  /** Tooltip birim etiketi (örn. "oturum") */
  valueUnit?: string;
}

export function LineChart({
  points,
  height = 120,
  color = "text-pim-mercan",
  zeroBased = true,
  formatY = (n) => n.toString(),
  emptyLabel = "Veri yok",
  valueUnit = "",
}: LineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const data = useMemo(() => {
    if (points.length === 0) return null;
    const ys = points.map((p) => p.y);
    const minY = zeroBased ? 0 : Math.min(...ys);
    const maxY = Math.max(...ys, 1);
    const padded = maxY - minY < 1 ? minY + 1 : maxY;
    return { minY, maxY: padded, ys };
  }, [points, zeroBased]);

  const peakIndex = useMemo(() => {
    if (points.length === 0) return -1;
    let max = -Infinity;
    let idx = 0;
    points.forEach((p, i) => {
      if (p.y > max) {
        max = p.y;
        idx = i;
      }
    });
    return idx;
  }, [points]);

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
  const padLeft = 44;
  const padRight = 8;
  const padY = 12;
  const innerW = W - padLeft - padRight;
  const innerH = H - padY * 2;

  const range = data.maxY - data.minY || 1;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const yTicks = [0, 0.33, 0.66, 1].map((t) => data.minY + range * t);

  const xy = points.map((p, i) => {
    const x = padLeft + i * step;
    const y = padY + innerH - ((p.y - data.minY) / range) * innerH;
    return { x, y, raw: p };
  });

  const linePath = xy
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${xy[xy.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${xy[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  const hoveredPoint = hovered != null ? xy[hovered] : null;
  const peakPoint = peakIndex >= 0 ? xy[peakIndex] : null;

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
        {yTicks.map((tick, i) => {
          const t = i / (yTicks.length - 1);
          const y = padY + innerH * (1 - t);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : "2 4"}
              />
              <text
                x={padLeft - 6}
                y={y + 3.5}
                textAnchor="end"
                className="fill-gri-500"
                style={{ fontSize: 10 }}
              >
                {formatY(tick)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="currentColor" fillOpacity="0.12" />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xy.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hovered === i ? 5 : 3}
              fill="white"
              stroke="currentColor"
              strokeWidth="2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}
        {peakPoint && peakPoint.raw.y > 0 && hovered == null && (
          <text
            x={peakPoint.x}
            y={Math.max(peakPoint.y - 8, padY + 10)}
            textAnchor="middle"
            className="fill-lacivert font-medium"
            style={{ fontSize: 11 }}
          >
            {formatY(peakPoint.raw.y)}
          </text>
        )}
      </svg>

      {hoveredPoint && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-gri-200 bg-white px-2 py-1 text-[11px] font-medium text-lacivert shadow-sm"
          style={{
            left: `${((hoveredPoint.x / W) * 100).toFixed(1)}%`,
            top: 0,
            transform: "translate(-50%, -100%)",
          }}
        >
          {hoveredPoint.raw.x}
          {valueUnit ? `: ${formatY(hoveredPoint.raw.y)} ${valueUnit}` : `: ${formatY(hoveredPoint.raw.y)}`}
        </div>
      )}

      <div className="mt-1.5 flex justify-between px-1 text-[10.5px] tabular-nums text-gri-500">
        <span>{points[0].x}</span>
        {points.length > 2 && (
          <span>{points[Math.floor(points.length / 2)].x}</span>
        )}
        <span>{points[points.length - 1].x}</span>
      </div>
    </div>
  );
}
