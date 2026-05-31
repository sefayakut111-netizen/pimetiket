import { ALL_CUT_SETS, CUT_SET_META, type CutSet } from "@/lib/templates/die-cut-templates";

const USAGE: Record<CutSet, string> = {
  kisscut: "Sticker ve soyularak çıkan etiketler.",
  thrucut: "Kartela, askılı etiket, ayrı parça olarak verilen ürünler.",
};

/** Kesim seti renk açıklaması — CUT_SET_META tek kaynak */
export function CutColorNote() {
  return (
    <details className="mt-3 rounded-lg ring-1 ring-gri-200 bg-gri-50/60 px-3 py-2">
      <summary className="cursor-pointer text-[12px] font-semibold text-gri-700 select-none">
        Kesim çizgisi renkleri ne demek?
      </summary>
      <div className="mt-2 space-y-2.5 text-[11.5px] text-gri-700 leading-relaxed">
        {ALL_CUT_SETS.map((set) => {
          const meta = CUT_SET_META[set];
          const isKiss = set === "kisscut";
          return (
            <div key={set}>
              <div className="font-semibold text-lacivert">
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                {isKiss ? "Magenta çizgi" : "Mavi çizgi"} — {meta.label}{" "}
                <span className="font-normal text-gri-600">(spot: {meta.spot})</span>
              </div>
              <p className="mt-0.5 pl-4">{meta.desc}</p>
              <p className="mt-0.5 pl-4 text-gri-600">
                Nerede: {USAGE[set]}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}
