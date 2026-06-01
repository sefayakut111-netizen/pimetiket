/** Editör önizlemesindeki kontur renkleri — her zaman görünür legend */

const ITEMS: {
  color: string;
  label: string;
  desc: string;
  dashed?: boolean;
}[] = [
  {
    color: "#ff0080",
    label: "Bıçak",
    desc: "Kesim çizgisi (magenta)",
  },
  {
    color: "#64748b",
    label: "Beyaz plan",
    desc: "Baskı altı beyaz mürekkep (gri tarama)",
    dashed: true,
  },
  {
    color: "#ef4444",
    label: "Taşma",
    desc: "Bleed alanı (kırmızı kesik)",
    dashed: true,
  },
  {
    color: "#3b82f6",
    label: "Güvenli alan",
    desc: "Safe zone (mavi)",
    dashed: true,
  },
];

export function EditorPreviewLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-gri-200 bg-gri-50/80 px-3 py-2"
      aria-label="Önizleme renk açıklaması"
    >
      <span className="text-[11px] font-semibold text-gri-600 shrink-0">
        Renkler:
      </span>
      {ITEMS.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 text-[11px] text-gri-700"
          title={item.desc}
        >
          <span
            className="inline-block h-2.5 w-5 shrink-0 rounded-sm border border-gri-300"
            style={{
              backgroundColor: item.dashed ? "transparent" : item.color,
              borderTopColor: item.dashed ? item.color : undefined,
              borderTopWidth: item.dashed ? 2 : undefined,
              borderStyle: item.dashed ? "dashed" : "solid",
            }}
            aria-hidden
          />
          <span>
            <span className="font-medium text-lacivert">{item.label}</span>
            <span className="hidden sm:inline text-gri-600"> — {item.desc}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
