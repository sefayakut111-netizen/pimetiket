"use client";

/**
 * HeatMap — 7 gün × 24 saat ısı haritası.
 * Sipariş yoğunluğu zamansal dağılım için.
 */

interface HeatMapProps {
  /** matrix[day][hour] = sipariş sayısı, day 0=Pzt 6=Paz */
  matrix: number[][];
  emptyLabel?: string;
}

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function HeatMap({ matrix, emptyLabel = "Veri yok" }: HeatMapProps) {
  const flat = matrix.flat();
  const max = Math.max(...flat, 1);
  const total = flat.reduce((s, v) => s + v, 0);

  if (total === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-[12.5px] text-gri-500 italic">
        {emptyLabel}
      </div>
    );
  }

  const gridStyle = { gridTemplateColumns: "repeat(24, minmax(0, 1fr))" };

  return (
    <div>
      <div className="grid grid-cols-[28px_1fr] gap-1.5">
        {DAY_LABELS.map((day, d) => (
          <div key={d} className="contents">
            <div className="text-[10.5px] font-semibold text-gri-700 self-center">
              {day}
            </div>
            <div className="grid gap-[2px]" style={gridStyle}>
              {Array.from({ length: 24 }, (_, h) => {
                const v = matrix[d]?.[h] ?? 0;
                const intensity = v / max;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${v} sipariş`}
                    className="aspect-square rounded-[2px]"
                    style={{
                      backgroundColor:
                        v === 0
                          ? "#F1F2F4"
                          : `rgba(255, 77, 79, ${0.15 + intensity * 0.85})`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Hour scale */}
      <div className="grid grid-cols-[28px_1fr] gap-1.5 mt-1">
        <div></div>
        <div className="grid gap-[2px] text-[9px] text-gri-500 tabular-nums" style={gridStyle}>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 4 === 0 ? h : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
