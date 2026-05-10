"use client";

/**
 * BarChart — inline SVG dikey bar chart.
 * Saatlik dağılım, kategori karşılaştırması için.
 */

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
  /** Tüm bar'ları aynı renkte tutmak istersen */
  defaultColor?: string;
}

export function BarChart({
  bars,
  height = 140,
  formatY = (n) => n.toString(),
  emptyLabel = "Veri yok",
  defaultColor = "#FF4D4F",
}: BarChartProps) {
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
  const padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const barW = (innerW / bars.length) * 0.7;
  const slot = innerW / bars.length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        role="img"
        aria-label={`Bar grafiği — ${bars.length} kategori`}
      >
        {/* Grid */}
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
        {/* Bars */}
        {bars.map((b, i) => {
          const h = (b.value / maxV) * innerH;
          const x = padX + i * slot + (slot - barW) / 2;
          const y = padY + innerH - h;
          return (
            <g key={i}>
              <title>
                {b.label}: {formatY(b.value)}
              </title>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx="3"
                fill={b.color ?? defaultColor}
                opacity={b.value > 0 ? 1 : 0.25}
              />
            </g>
          );
        })}
      </svg>
      {/* X labels — sparse */}
      <div className="grid grid-flow-col auto-cols-fr text-[10px] text-gri-500 mt-1 px-1 tabular-nums">
        {bars.map((b, i) => (
          <span key={i} className="text-center truncate">
            {/* En fazla 12 etiket göster, ortada olanlar gizlensin */}
            {bars.length <= 12 || i % Math.ceil(bars.length / 8) === 0
              ? b.label
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
