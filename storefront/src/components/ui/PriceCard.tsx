"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Pill } from "./Pill";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

type Variant = "quiet" | "bold";

interface Upsell {
  msg: string;
  onClick: () => void;
}

interface PriceCardProps {
  variant?: Variant;
  topLabel: string; // "TOPLAM" | "SEÇİMİN"
  total: number;
  unitPrice: ReactNode;
  savingsLabel?: string | null;
  upsell?: Upsell | null;
  deliveryDate: string;
  ctaLabel: string;
  onCta?: () => void;
  footnote?: string | null;
  className?: string;
}

/**
 * Sepete ekle CTA + toplam fiyat kartı. İki bilinçli varyant:
 *   - "quiet": beyaz card + gradient top stripe (etiket — profesyonel sakin)
 *   - "bold":  lacivert gradient + mercan accent (sticker — enerjik premium)
 *
 * v1-jsx'teki ~100 satır inline price card'ı.
 */
export function PriceCard({
  variant = "quiet",
  topLabel,
  total,
  unitPrice,
  savingsLabel,
  upsell,
  deliveryDate,
  ctaLabel,
  onCta,
  footnote,
  className,
}: PriceCardProps) {
  const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

  if (variant === "bold") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl mt-2 p-6",
          "bg-gradient-to-br from-lacivert to-lacivert-soft text-white",
          className
        )}
      >
        <div
          aria-hidden
          className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full bg-pim-mercan opacity-15"
        />
        <div className="relative flex justify-between items-center gap-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-white/60">
              {topLabel}
            </div>
            <div
              key={Math.round(total)}
              className="animate-count-pulse text-[32px] font-bold tracking-tight mt-1"
            >
              {fmt(total)} <span className="text-lg opacity-70">TL</span>
            </div>
            <div className="text-[13px] text-white/70 mt-1">{unitPrice}</div>
          </div>
          {savingsLabel && (
            <span className="inline-flex items-center h-8 px-3.5 rounded-full bg-pim-mercan text-white text-[13px] font-semibold">
              {savingsLabel}
            </span>
          )}
        </div>

        <div className="relative mt-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/10 text-[13px]">
          <Icon.Calendar size={14} />
          <span>
            Tahmini teslim: <strong>{deliveryDate}</strong>
          </span>
        </div>

        <Button
          variant="primary"
          size="lg"
          block
          onClick={onCta}
          className="relative mt-4"
        >
          {ctaLabel} <Icon.ArrowR />
        </Button>

        {footnote && (
          <div className="relative mt-2.5 text-[13px] text-center text-white/60">
            {footnote}
          </div>
        )}
      </div>
    );
  }

  // "quiet" (default)
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg mt-2 p-6 bg-white shadow-1 ring-1 ring-black/[0.04]",
        className
      )}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pim-mercan to-turuncu"
      />

      <div className="flex justify-between items-end gap-4 mb-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            {topLabel}
          </div>
          <div
            key={Math.round(total)}
            className="animate-count-pulse text-[38px] font-bold tracking-tight leading-none"
          >
            {fmt(total)}{" "}
            <span className="text-[22px] font-semibold text-gri-700">TL</span>
          </div>
          <div className="text-[13px] text-gri-700 mt-1.5">{unitPrice}</div>
        </div>
        {savingsLabel && (
          <Pill variant="yesil" className="mb-1.5">
            {savingsLabel}
          </Pill>
        )}
      </div>

      {upsell && (
        <button
          type="button"
          onClick={upsell.onClick}
          className={cn(
            "flex items-center gap-2.5 w-full px-3.5 py-3 mb-3",
            "rounded-lg bg-sari-soft border border-dashed border-sari",
            "text-left text-[14px] font-semibold text-sari-koyu"
          )}
        >
          <span className="text-lg">💡</span>
          <span className="flex-1">{upsell.msg}</span>
          <Icon.ArrowR size={14} />
        </button>
      )}

      <div className="flex items-center gap-2.5 px-3.5 py-2.5 mb-4 rounded-lg bg-gri-50 text-[13px]">
        <Icon.Calendar size={16} />
        <span>
          Tahmini teslim: <strong>{deliveryDate}</strong>
        </span>
      </div>

      <Button variant="primary" size="lg" block onClick={onCta}>
        {ctaLabel} <Icon.ArrowR />
      </Button>

      {footnote && (
        <div className="mt-2.5 text-[13px] text-center text-gri-500">
          {footnote}
        </div>
      )}
    </div>
  );
}
