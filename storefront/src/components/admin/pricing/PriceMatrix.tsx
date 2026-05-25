"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { ProfileConfig } from "@/lib/pricing-config";
import { calculatePrice } from "@/lib/pricing-calc";
import { calcTabakaSheets } from "@/lib/pricing-tabaka-geo";
import {
  isPricebookMode,
  quoteRuloFromPricebook,
  FALLBACK_PRICEBOOK_SNAPSHOT,
} from "@/lib/pricing-pricebook";

type MatrixScope = "sticker" | "etiket_rulo" | "etiket_tabaka";

export interface PriceMatrixProps {
  config: ProfileConfig;
  scope: MatrixScope;
  materialId: string;
  selectedOptions: Record<string, string | string[]>;
}

const SIZE_PRESETS = [
  { w: 30, h: 30, label: "30×30" },
  { w: 50, h: 50, label: "50×50" },
  { w: 75, h: 75, label: "75×75" },
  { w: 100, h: 100, label: "100×100" },
  { w: 150, h: 150, label: "150×150" },
];

const QTY_PRESETS: Record<MatrixScope, number[]> = {
  sticker: [25, 50, 100, 250, 500, 1000],
  etiket_rulo: [1000, 3000, 5000, 10000],
  etiket_tabaka: [250, 500, 1000, 2500, 5000],
};

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("tr-TR") + " ₺";
}

function profitPctFromTotal(
  total: number,
  config: ProfileConfig
): number {
  const subtotal = total / (1 + config.vat.pct / 100);
  const feeAmount = subtotal * (config.operation.fee_pct / 100);
  const marginAmount =
    (subtotal - feeAmount) * (config.margin.pct / (100 + config.margin.pct));
  return subtotal > 0 ? (marginAmount / subtotal) * 100 : 0;
}

function cellColor(profitPct: number): string {
  if (profitPct > 25) return "bg-yesil-soft/50 text-yesil-koyu";
  if (profitPct >= 15) return "bg-sari-soft/40 text-sari-koyu";
  return "bg-kirmizi/10 text-kirmizi";
}

interface CellData {
  total: number;
  unitPrice: number;
  profitPct: number;
  marginTry: number;
}

function quoteCell(
  config: ProfileConfig,
  scope: MatrixScope,
  materialId: string,
  selectedOptions: Record<string, string | string[]>,
  w: number,
  h: number,
  qty: number
): CellData | null {
  const isSheet = config.pricing_mode === "sheet" || scope === "etiket_tabaka";
  const isPricebook = isPricebookMode(config) || scope === "etiket_rulo";

  if (isPricebook && scope === "etiket_rulo") {
    const r = quoteRuloFromPricebook(FALLBACK_PRICEBOOK_SNAPSHOT, config, {
      width_mm: w,
      height_mm: h,
      qty,
      material_key: materialId,
      selected_options: selectedOptions,
    });
    if (!r.ok) return null;
    const profitPct = profitPctFromTotal(r.total, config);
    const subtotal = r.total / (1 + config.vat.pct / 100);
    const feeAmount = subtotal * (config.operation.fee_pct / 100);
    const marginTry =
      (subtotal - feeAmount) * (config.margin.pct / (100 + config.margin.pct));
    return {
      total: r.total,
      unitPrice: r.unitPrice,
      profitPct,
      marginTry,
    };
  }

  const sheets_needed = isSheet ? calcTabakaSheets(w, h, qty) : undefined;
  const r = calculatePrice(
    {
      width_mm: w,
      height_mm: h,
      qty,
      material_id: materialId,
      selected_options: selectedOptions,
      sheets_needed,
    },
    config
  );
  if (!r.ok) return null;

  const total = r.final;
  const profitPct = profitPctFromTotal(total, config);
  const subtotal = total / (1 + config.vat.pct / 100);
  const feeAmount = subtotal * (config.operation.fee_pct / 100);
  const marginTry =
    (subtotal - feeAmount) * (config.margin.pct / (100 + config.margin.pct));

  return {
    total,
    unitPrice: r.unit_price,
    profitPct,
    marginTry,
  };
}

export function PriceMatrix({
  config,
  scope,
  materialId,
  selectedOptions,
}: PriceMatrixProps) {
  const qtyCols = QTY_PRESETS[scope];
  const material = config.materials.find((m) => m.id === materialId);

  const matrix = useMemo(() => {
    const rows: Array<{
      size: (typeof SIZE_PRESETS)[number];
      cells: (CellData | null)[];
    }> = [];

    for (const size of SIZE_PRESETS) {
      const cells = qtyCols.map((qty) =>
        quoteCell(config, scope, materialId, selectedOptions, size.w, size.h, qty)
      );
      rows.push({ size, cells });
    }
    return rows;
  }, [config, scope, materialId, selectedOptions, qtyCols]);

  if (!materialId) {
    return (
      <p className="text-[12px] text-gri-500 italic py-2">
        Matris için malzeme seç
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <p className="text-[11px] text-gri-600 mb-2">
        {material?.name ?? materialId} — KDV dahil toplam · renk = kâr marjı
      </p>
      <table className="w-full min-w-[520px] border-collapse text-[11px]">
        <thead>
          <tr className="bg-gri-100">
            <th className="px-2 py-1.5 text-left font-semibold text-gri-700 border border-gri-200">
              Boyut
            </th>
            {qtyCols.map((q) => (
              <th
                key={q}
                className="px-2 py-1.5 text-center font-semibold text-gri-700 border border-gri-200 whitespace-nowrap"
              >
                {q.toLocaleString("tr-TR")} ad
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map(({ size, cells }) => (
            <tr key={size.label}>
              <td className="px-2 py-1.5 font-medium text-lacivert border border-gri-200 whitespace-nowrap">
                {size.label} mm
              </td>
              {cells.map((cell, i) => (
                <td
                  key={qtyCols[i]}
                  className={cn(
                    "px-2 py-1.5 text-center border border-gri-200 tabular-nums font-semibold cursor-default",
                    cell ? cellColor(cell.profitPct) : "text-gri-400"
                  )}
                  title={
                    cell
                      ? `${size.label} / ${qtyCols[i]} adet\nBirim: ${cell.unitPrice.toFixed(2)} ₺\nToplam: ${fmtMoney(cell.total)} (KDV dahil)\nKâr: ${fmtMoney(cell.marginTry)} (%${cell.profitPct.toFixed(0)})`
                      : "Hesaplanamadı"
                  }
                >
                  {cell ? fmtMoney(cell.total) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gri-600">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yesil-soft/50" /> Kâr &gt; %25
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-sari-soft/40" /> %15–25
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-kirmizi/10" /> &lt; %15
        </span>
      </div>
    </div>
  );
}
