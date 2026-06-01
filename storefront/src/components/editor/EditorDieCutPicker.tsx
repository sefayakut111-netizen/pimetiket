"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  DIE_CUT_TEMPLATES,
  type DieCutTemplate,
  type ShapeCategory,
} from "@/lib/templates/die-cut-templates";

const CATEGORIES: ShapeCategory[] = [
  "yuvarlak",
  "kare",
  "dikdortgen",
  "oval",
  "bumper",
];

export function EditorDieCutPicker({
  onSelect,
  activeId,
}: {
  onSelect: (tpl: DieCutTemplate) => void;
  activeId?: string | null;
}) {
  const [category, setCategory] = useState<ShapeCategory>("yuvarlak");

  const items = useMemo(
    () => DIE_CUT_TEMPLATES.filter((t) => t.category === category),
    [category]
  );

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Şablon kategorisi"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
              category === cat
                ? "bg-pim-mercan text-white"
                : "bg-gri-100 text-gri-700 hover:bg-gri-200"
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="max-h-[220px] overflow-y-auto rounded-lg border border-gri-200 bg-gri-50/50 p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {items.map((tpl) => {
            const selected = activeId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelect(tpl)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left transition-colors",
                  selected
                    ? "bg-pim-mercan text-white shadow-sm"
                    : "bg-white text-gri-800 ring-1 ring-gri-200 hover:ring-pim-mercan/40"
                )}
              >
                <span className="block text-[11px] font-medium leading-tight">
                  {tpl.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-[10px] tabular-nums",
                    selected ? "text-white/85" : "text-gri-500"
                  )}
                >
                  {tpl.shape === "circle"
                    ? `Ø${tpl.widthMm} mm`
                    : `${tpl.widthMm}×${tpl.heightMm} mm`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-gri-500 leading-snug">
        <Link
          href="/sablonlar?tab=kesim"
          className="text-pim-mercan underline"
        >
          Tüm şablonları gör →
        </Link>
      </p>
    </div>
  );
}
