/** Editör önizlemesindeki kontur renkleri — her zaman görünür legend */

import type { CutSet } from "@/lib/templates/die-cut-templates";
import { CUT_SET_META } from "@/lib/templates/die-cut-templates";

const STATIC_ITEMS: {
  color: string;
  label: string;
  short: string;
  dashed?: boolean;
}[] = [
  {
    color: "#64748b",
    label: "Beyaz plan",
    short: "Beyaz mürekkep",
    dashed: true,
  },
  { color: "#ef4444", label: "Taşma payı", short: "Taşma", dashed: true },
  { color: "#3b82f6", label: "Güvenli alan", short: "Güvenli", dashed: true },
];

function LegendSwatch({
  color,
  dashed,
}: {
  color: string;
  dashed?: boolean;
}) {
  if (dashed) {
    return (
      <svg
        width="28"
        height="12"
        viewBox="0 0 28 12"
        className="shrink-0"
        aria-hidden
      >
        <line
          x1="2"
          y1="6"
          x2="26"
          y2="6"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <span
      className="inline-block h-3 w-7 shrink-0 rounded-sm"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export function EditorPreviewLegend({ cutType = "kisscut" }: { cutType?: CutSet }) {
  const cutMeta = CUT_SET_META[cutType];
  const cutShort =
    cutType === "thrucut" ? "Tam kesim (ayrılır)" : "Yarım kesim (soyulur)";

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-gri-200 bg-white px-3 py-2.5 shadow-sm"
      aria-label="Önizleme renk açıklaması"
    >
      <span className="text-[13px] font-semibold text-lacivert shrink-0">
        Renkler
      </span>
      <span
        className="inline-flex items-center gap-2 rounded-full bg-gri-50 px-2.5 py-1 ring-1 ring-gri-200"
        title={`Bıçak: ${cutShort}`}
      >
        <LegendSwatch color={cutMeta.color} dashed />
        <span className="text-[13px] font-medium leading-none text-lacivert">
          Bıçak
        </span>
        <span className="hidden text-[12px] text-gri-600 sm:inline">
          {cutShort}
        </span>
      </span>
      {STATIC_ITEMS.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full bg-gri-50 px-2.5 py-1 ring-1 ring-gri-200"
          title={`${item.label}: ${item.short}`}
        >
          <LegendSwatch color={item.color} dashed={item.dashed} />
          <span className="text-[13px] font-medium leading-none text-lacivert">
            {item.label}
          </span>
          <span className="hidden text-[12px] text-gri-600 sm:inline">
            {item.short}
          </span>
        </span>
      ))}
    </div>
  );
}
