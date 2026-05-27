/**
 * GeoDistributionTreemap — İl bazlı kargo dağılımı görseli.
 *
 * Sefa 18 May v68 (Faz 3):
 * 81 il SVG haritası 1MB+ olur, Vercel build/load süresine ekstra
 * yük getirir. Pragmatik alternatif: top 10 il "büyük kart" + diğerleri
 * compact liste. Renk avg_days ile (yeşil=hızlı, sarı=orta, kırmızı=yavaş).
 *
 * Sefa tek bakışta görür: hangi ilden kaç sipariş, hangisi yavaş.
 */

"use client";

import { cn } from "@/lib/cn";

export interface CityStat {
  city: string;
  count: number;
  avg_days: number | null;
  delivered: number;
  failed: number;
  in_transit: number;
}

function colorForAvg(days: number | null): {
  bg: string;
  ring: string;
  text: string;
} {
  if (days === null) {
    return {
      bg: "bg-gri-100",
      ring: "ring-gri-200",
      text: "text-gri-500",
    };
  }
  if (days <= 2) {
    return {
      bg: "bg-yesil-soft",
      ring: "ring-yesil/30",
      text: "text-yesil-koyu",
    };
  }
  if (days <= 3.5) {
    return {
      bg: "bg-sari-soft",
      ring: "ring-sari/30",
      text: "text-sari-koyu",
    };
  }
  return {
    bg: "bg-kirmizi-soft",
    ring: "ring-kirmizi/30",
    text: "text-kirmizi-koyu",
  };
}

export function GeoDistributionTreemap({
  cities,
  fastest,
  slowest,
}: {
  cities: CityStat[];
  fastest: { city: string; avg_days: number } | null;
  slowest: { city: string; avg_days: number } | null;
}) {
  if (cities.length === 0) {
    return (
      <div className="text-center text-sm text-gri-500 py-10">
        Henüz şehir bazlı veri yok
      </div>
    );
  }

  const top10 = cities.slice(0, 10);
  const rest = cities.slice(10);
  const restTotal = rest.reduce((s, c) => s + c.count, 0);
  const maxCount = top10[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* En hızlı / en yavaş özet */}
      {(fastest || slowest) && (
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {fastest && (
            <div className="rounded-lg bg-yesil-soft p-2 ring-1 ring-yesil/30">
              <div className="text-yesil-koyu font-semibold">
                 En hızlı: {fastest.city}
              </div>
              <div className="text-gri-700">
                ortalama {fastest.avg_days} gün
              </div>
            </div>
          )}
          {slowest && (
            <div className="rounded-lg bg-kirmizi-soft p-2 ring-1 ring-kirmizi/30">
              <div className="text-kirmizi-koyu font-semibold">
                 En yavaş: {slowest.city}
              </div>
              <div className="text-gri-700">
                ortalama {slowest.avg_days} gün
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top 10 — büyük kartlar (count'a göre bar) */}
      <div className="space-y-1.5">
        {top10.map((c) => {
          const pct = (c.count / maxCount) * 100;
          const color = colorForAvg(c.avg_days);
          return (
            <div
              key={c.city}
              className={cn(
                "relative rounded-lg ring-1 overflow-hidden",
                color.ring
              )}
            >
              {/* Bar arkaplan */}
              <div
                className={cn("absolute inset-y-0 left-0", color.bg)}
                style={{ width: `${pct}%` }}
              />
              {/* İçerik */}
              <div className="relative flex items-center justify-between px-3 py-2 text-[12.5px]">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-lacivert min-w-[110px]">
                    {c.city}
                  </span>
                  <span className="text-gri-700">
                    {c.count} kargo
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11.5px]">
                  {c.avg_days !== null && (
                    <span className={cn("font-semibold", color.text)}>
                      {c.avg_days} gün
                    </span>
                  )}
                  <span className="text-gri-500">
                    {c.delivered > 0 && ` ${c.delivered}`}
                    {c.in_transit > 0 && (
                      <span className="ml-2"> {c.in_transit}</span>
                    )}
                    {c.failed > 0 && (
                      <span className="ml-2 text-kirmizi-koyu">
                         {c.failed}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diğerleri özet */}
      {rest.length > 0 && (
        <details className="rounded-lg border border-gri-200">
          <summary className="cursor-pointer px-3 py-2 text-[12.5px] text-gri-700 hover:bg-gri-50">
            +{rest.length} il daha · {restTotal} kargo
          </summary>
          <div className="border-t border-gri-200 p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            {rest.map((c) => (
              <div key={c.city} className="flex items-center justify-between">
                <span className="text-gri-700">{c.city}</span>
                <span className="text-gri-500">{c.count}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
