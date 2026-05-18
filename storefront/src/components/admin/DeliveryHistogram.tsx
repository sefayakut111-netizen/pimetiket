/**
 * DeliveryHistogram — Teslim süresi dağılımı bar chart.
 *
 * Sefa 18 May v68 (Faz 3):
 * X ekseninde teslim süresi bucket'ları (0-1 gün, 1-2, ..., 7+),
 * Y ekseninde kargo sayısı. Hangi süre aralığında yoğunluk var
 * tek bakışta görülür.
 *
 * Veri kaynağı: GeoDistribution API'den cities[].delivered + avg_days
 * yerine doğrudan order_assignments'tan hesaplanır.
 */

"use client";

import { useState } from "react";

export interface DeliveryDay {
  /** "0-1 gün", "1-2 gün", ... */
  bucket: string;
  count: number;
}

export function DeliveryHistogram({ data }: { data: DeliveryDay[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="text-center text-sm text-gri-500 py-10">
        Henüz yeterli teslimat verisi yok
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 10, bottom: 40, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barWidth = chartW / data.length;
  const barInner = barWidth * 0.7;

  function colorForBucket(idx: number): string {
    // Daha kısa süre = daha yeşil
    if (idx <= 1) return "#22c55e"; // yesil
    if (idx <= 3) return "#84cc16"; // light yesil
    if (idx <= 4) return "#eab308"; // sari
    return "#ef4444"; // kirmizi
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
                {Math.round(maxCount * p)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + i * barWidth;
          const barH = (d.count / maxCount) * chartH;
          const barY = padding.top + chartH - barH;
          const cx = x + barWidth / 2;
          const fill = colorForBucket(i);

          return (
            <g
              key={d.bucket}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={cx - barInner / 2}
                y={barY}
                width={barInner}
                height={barH}
                fill={fill}
                opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4}
                rx={3}
              />
              {/* Sayı barın üstünde */}
              {d.count > 0 && (
                <text
                  x={cx}
                  y={barY - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#374151"
                  fontWeight="600"
                >
                  {d.count}
                </text>
              )}
              {/* X label */}
              <text
                x={cx}
                y={height - padding.bottom + 14}
                textAnchor="middle"
                fontSize={10}
                fill="#6b7280"
              >
                {d.bucket}
              </text>
              <text
                x={cx}
                y={height - padding.bottom + 26}
                textAnchor="middle"
                fontSize={9}
                fill="#9ca3af"
              >
                gün
              </text>
            </g>
          );
        })}
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
          <div className="font-semibold">{data[hoverIdx].bucket} gün</div>
          <div>
            {data[hoverIdx].count} kargo (
            {Math.round((data[hoverIdx].count / total) * 100)}%)
          </div>
        </div>
      )}

      {/* Özet */}
      <div className="mt-2 text-[11.5px] text-gri-500 text-center">
        Toplam {total} teslim · Renk: yeşil = hızlı, kırmızı = yavaş
      </div>
    </div>
  );
}
