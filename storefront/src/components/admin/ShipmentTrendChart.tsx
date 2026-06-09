/**
 * ShipmentTrendChart — Son 14 gün günlük kargolama/teslim trend.
 *
 * Sefa 18 May v68:
 * Hafif SVG bar chart. Recharts kullanmadan, ekstra dependency yok.
 *
 * 2 dataset: shipped (mavi) + delivered (yeşil)
 * Hover'da tooltip (tarih + sayılar)
 */

"use client";

import { useState } from "react";

export interface TrendPoint {
  day: string; // ISO date "2026-05-18"
  shipped: number;
  delivered: number;
}

export function ShipmentTrendChart({ data }: { data: TrendPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="text-center text-sm text-gri-500 py-10">
        Yeterli veri yok
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.shipped, d.delivered)),
    1
  );
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 10, bottom: 30, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barWidth = chartW / data.length;
  const barInner = barWidth * 0.35; // 2 yan yana bar

  function fmtDay(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = padding.top + chartH * (1 - p);
          return (
            <g key={p}>
              <line
                x1={padding.left}
                x2={padding.left + chartW}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={padding.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#6b7280"
              >
                {Math.round(maxValue * p)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + i * barWidth;
          const shippedH = (d.shipped / maxValue) * chartH;
          const deliveredH = (d.delivered / maxValue) * chartH;
          const shippedY = padding.top + chartH - shippedH;
          const deliveredY = padding.top + chartH - deliveredH;
          const cx = x + barWidth / 2;
          const showLabel = i % 2 === 0; // her 2 günde bir x label

          return (
            <g
              key={d.day}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Shipped bar (mavi) */}
              <rect
                x={cx - barInner - 1}
                y={shippedY}
                width={barInner}
                height={shippedH}
                fill={hoverIdx === i ? "#2563eb" : "#3b82f6"}
                rx={1}
              />
              {/* Delivered bar (yeşil) */}
              <rect
                x={cx + 1}
                y={deliveredY}
                width={barInner}
                height={deliveredH}
                fill={hoverIdx === i ? "#16a34a" : "#22c55e"}
                rx={1}
              />

              {/* X label */}
              {showLabel && (
                <text
                  x={cx}
                  y={height - padding.bottom + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#6b7280"
                >
                  {fmtDay(d.day)}
                </text>
              )}

              {/* Hover bg */}
              <rect
                x={x}
                y={padding.top}
                width={barWidth}
                height={chartH}
                fill="transparent"
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${height - 8})`}>
          <rect x={0} y={-6} width={8} height={8} fill="#3b82f6" rx={1} />
          <text x={12} y={1} fontSize={10} fill="#2c2d3e">
            Kargolanan
          </text>
          <rect x={80} y={-6} width={8} height={8} fill="#22c55e" rx={1} />
          <text x={92} y={1} fontSize={10} fill="#2c2d3e">
            Teslim edilen
          </text>
        </g>
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && data[hoverIdx] && (
        <div
          className="absolute bg-lacivert text-white text-[11px] rounded px-2 py-1 pointer-events-none shadow-lg"
          style={{
            top: 8,
            left: `${((hoverIdx + 0.5) / data.length) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold">{fmtDay(data[hoverIdx].day)}</div>
          <div> {data[hoverIdx].shipped} kargolanan</div>
          <div> {data[hoverIdx].delivered} teslim</div>
        </div>
      )}
    </div>
  );
}
