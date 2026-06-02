"use client";

import { useMemo } from "react";
import { RollPlanSvg } from "@/components/pricing/RollPlanSvg";
import { SheetPreviewSvg } from "@/components/pricing/SheetPreviewSvg";
import {
  computeOrderItemLayoutGeometry,
  showSheetPreviewForLayout,
  summarizeProductionLayout,
  type OrderItemLayoutInput,
} from "@/lib/item-layout-geometry";

interface PartnerProductionLayoutProps {
  item: OrderItemLayoutInput;
}

/**
 * Partner portal — üretim dizgi layout'u (SVG).
 * Müşteri fiyatı / m² satış / kâr GÖSTERİLMEZ.
 */
export function PartnerProductionLayout({ item }: PartnerProductionLayoutProps) {
  const geometry = useMemo(
    () => computeOrderItemLayoutGeometry(item),
    [item.product, item.width, item.height, item.qty, item.meta]
  );

  if (!geometry) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-gri-200 bg-gri-50 px-4 py-3 text-xs text-gri-600">
        Bu kalem için dizgi layout&apos;u hesaplanamadı.
      </div>
    );
  }

  const summary = summarizeProductionLayout(geometry, item.product);
  const showSheet = showSheetPreviewForLayout(geometry);

  return (
    <section
      className="mt-4 rounded-xl border border-gri-200 bg-krem-soft/40 p-4"
      aria-label="Üretim dizgi layout'u"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gri-700 mb-2">
        Üretim dizgisi
      </p>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] text-gri-700 tabular-nums">
        <div>
          <dt className="text-gri-500">Kesim</dt>
          <dd className="font-semibold text-lacivert">{summary.cutLabel}</dd>
        </div>
        <div>
          <dt className="text-gri-500">Grid</dt>
          <dd className="font-semibold text-lacivert">{summary.grid}</dd>
        </div>
        <div>
          <dt className="text-gri-500">{summary.unitLabel}</dt>
          <dd className="font-semibold text-lacivert">{summary.perUnit}</dd>
        </div>
        <div>
          <dt className="text-gri-500">{summary.unitsLabel}</dt>
          <dd className="font-semibold text-lacivert">{summary.unitsNeeded}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gri-500">Ölçü</dt>
          <dd className="font-semibold text-lacivert">{summary.sheetOrRollSize}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gri-500">Üretim adedi</dt>
          <dd className="font-semibold text-lacivert">
            {summary.producedQty.toLocaleString("tr-TR")} (sipariş:{" "}
            {item.qty.toLocaleString("tr-TR")})
          </dd>
        </div>
      </dl>

      {showSheet && (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold text-gri-700">
            İç tabaka dizgisi
          </p>
          <div className="rounded-lg bg-white ring-1 ring-gri-200 p-3 overflow-hidden">
            <SheetPreviewSvg geometry={geometry} />
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold text-gri-700">
          {showSheet ? "Plotter rulo planı" : "Plotter dizgisi (die-cut)"}
        </p>
        <div className="rounded-lg bg-white ring-1 ring-gri-200 p-3 overflow-x-auto">
          <RollPlanSvg geometry={geometry} maxRollsToShow={2} />
        </div>
      </div>
    </section>
  );
}
