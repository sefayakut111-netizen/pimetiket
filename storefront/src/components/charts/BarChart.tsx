"use client";

/**
 * BarChart — inline SVG dikey bar chart.
 */

import { useState } from "react";

export interface BarPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  bars: BarPoint[];
  height?: number;
  formatY?: (n: number) => string;
  emptyLabel?: string;
  defaultColor?: string;
  /** Tooltip birim etiketi (örn. "oturum") */
  valueUnit?: string;
}

export function BarChart({
  bars,
  height = 140,
  formatY = (n) => n.toString(),
  emptyLabel = "Veri yok",
  defaultColor = "#FF4D4F",
  valueUnit = "",
}: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = bars.reduce((s, b) => s + b.value, 0);

  if (bars.length === 0 || total === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-[12.5px] text-gri-500"
      >
        {emptyLabel}
      </div>
    );
  }

  const maxV = Math.max(...bars.map((b) => b.value), 1);
  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const barW = (innerW / bars.length) * 0.7;
  const slot = innerW / bars.length;
  const labelStride =
    bars.length <= 8 ? 1 : Math.ceil(bars.length / 6);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        role="img"
        aria-label={`Bar grafiği — ${bars.length} kategori`}
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            y1={padY + innerH * t}
            x2={W - padX}
            y2={padY + innerH * t}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
          />
        ))}
        {bars.map((b, i) => {
          const h = (b.value / maxV) * innerH;
          const x = padX + i * slot + (slot - barW) / 2;
          const y = padY + innerH - h;
          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx="3"
                fill={b.color ?? defaultColor}
                opacity={hovered === i ? 1 : b.value > 0 ? 0.92 : 0.25}
              />
              {b.value > 0 && (
                <text
                  x={x + barW / 2}
                  y={Math.max(y - 4, padY + 8)}
                  textAnchor="middle"
                  className="fill-lacivert font-medium"
                  style={{ fontSize: 11 }}
                >
                  {formatY(b.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered != null && bars[hovered] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-gri-200 bg-white px-2 py-1 text-[11px] font-medium text-lacivert shadow-sm"
          style={{
            left: `${(((padX + hovered * slot + slot / 2) / W) * 100).toFixed(1)}%`,
            top: 0,
            transform: "translate(-50%, -100%)",
          }}
        >
          {bars[hovered].label}
          {valueUnit
            ? `: ${formatY(bars[hovered].value)} ${valueUnit}`
            : `: ${formatY(bars[hovered].value)}`}
        </div>
      )}

      <div className="mt-1 grid grid-flow-col auto-cols-fr px-1 text-[10px] tabular-nums text-gri-500">
        {bars.map((b, i) => (
          <span key={i} className="truncate text-center">
            {i % labelStride === 0
              ? `${b.label} · ${formatY(b.value)}`
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
