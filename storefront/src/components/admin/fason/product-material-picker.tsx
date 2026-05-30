"use client";

import { cn } from "@/lib/cn";
import {
  FASON_MATERIAL_LABELS,
  type FasonMaterial,
} from "@/components/admin/fason/fason-capabilities";

export function ProductMaterialPicker({
  productLabel,
  options,
  selected,
  onChange,
  readOnly = false,
}: {
  productLabel: string;
  options: FasonMaterial[];
  selected: FasonMaterial[];
  onChange?: (next: FasonMaterial[]) => void;
  readOnly?: boolean;
}) {
  const allSelected =
    options.length > 0 && options.every((m) => selected.includes(m));

  const toggleAll = () => {
    if (readOnly || !onChange) return;
    onChange(allSelected ? [] : [...options]);
  };

  const toggleOne = (m: FasonMaterial) => {
    if (readOnly || !onChange) return;
    onChange(
      selected.includes(m)
        ? selected.filter((x) => x !== m)
        : [...selected, m]
    );
  };

  return (
    <div className="rounded-xl border border-gri-200 bg-gri-50/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[12.5px] font-semibold text-lacivert">
          {productLabel}
        </span>
        <span className="text-[11px] text-gri-500 tabular-nums">
          {selected.length}/{options.length}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {!readOnly && (
          <button
            type="button"
            onClick={toggleAll}
            aria-pressed={allSelected}
            className={cn(
              "px-3 h-9 rounded-full text-[12.5px] font-semibold transition-colors",
              allSelected
                ? "bg-lacivert text-white"
                : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-lacivert"
            )}
          >
            Tumu
          </button>
        )}
        {options.map((m) => {
          const active = selected.includes(m);
          const chipClass = cn(
            "px-3 h-9 rounded-full text-[12.5px] font-semibold transition-colors",
            active
              ? "bg-pim-mercan text-white"
              : "bg-white ring-1 ring-gri-200 text-gri-700",
            !readOnly && !active && "hover:ring-pim-mercan cursor-pointer"
          );
          if (readOnly) {
            return (
              <span key={m} className={chipClass}>
                {FASON_MATERIAL_LABELS[m]}
              </span>
            );
          }
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleOne(m)}
              aria-pressed={active}
              className={chipClass}
            >
              {FASON_MATERIAL_LABELS[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
