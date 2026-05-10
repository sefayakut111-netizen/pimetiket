"use client";

/**
 * DonutChart — inline SVG donut/pie + legend.
 * Toplamı 0 ise "Veri yok" gösterir (fake number YOK).
 */

interface DonutSlice {
  label: string;
  value: number;
  color: string; // hex veya tailwind-uyumlu hex
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  emptyLabel?: string;
}

export function DonutChart({
  slices,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
  emptyLabel = "Veri yok",
}: DonutChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          style={{ width: size, height: size }}
          className="rounded-full border-[18px] border-gri-100 grid place-items-center"
        >
          <div className="text-center">
            <div className="text-[10.5px] uppercase tracking-[0.04em] text-gri-500">
              {centerLabel ?? "Toplam"}
            </div>
            <div className="text-[20px] font-bold text-gri-500">—</div>
          </div>
        </div>
        <p className="text-[12px] text-gri-500 italic">{emptyLabel}</p>
      </div>
    );
  }

  let offset = 0;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} role="img" aria-label="Donut grafiği">
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-gri-100"
          strokeWidth={thickness}
        />
        {/* Slices */}
        {slices.map((s, i) => {
          if (s.value === 0) return null;
          const portion = s.value / total;
          const dash = portion * circumference;
          const gap = circumference - dash;
          const dashArray = `${dash.toFixed(2)} ${gap.toFixed(2)}`;
          const dashOffset = -offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            >
              <title>
                {s.label}: {s.value} ({(portion * 100).toFixed(0)}%)
              </title>
            </circle>
          );
        })}
        {/* Center label */}
        {(centerLabel || centerValue) && (
          <g transform={`translate(${cx},${cy})`}>
            {centerLabel && (
              <text
                textAnchor="middle"
                y="-6"
                className="fill-current text-gri-500"
                style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                {centerLabel}
              </text>
            )}
            {centerValue && (
              <text
                textAnchor="middle"
                y="14"
                className="fill-current text-lacivert"
                style={{ fontSize: "20px", fontWeight: 700 }}
              >
                {centerValue}
              </text>
            )}
          </g>
        )}
      </svg>

      {/* Legend */}
      <ul className="w-full space-y-1.5">
        {slices.map((s, i) => {
          const pct = (s.value / total) * 100;
          return (
            <li
              key={i}
              className="flex items-center gap-2 text-[12.5px]"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-gri-700 truncate flex-1">{s.label}</span>
              <span className="font-semibold tabular-nums text-lacivert">
                {s.value}
              </span>
              <span className="text-gri-500 tabular-nums w-9 text-right">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
