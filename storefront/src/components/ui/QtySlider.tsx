"use client";

import type { ChangeEvent } from "react";
import { cn } from "@/lib/cn";

interface QtySliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Custom range slider — 22px lacivert thumb (4px beyaz border + soft shadow),
 * 6px gri track. Tailwind 4'te slider thumb stillemesi için inline <style>.
 */
export function QtySlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  ariaLabel = "Miktar",
}: QtySliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    onChange(Number(e.target.value));

  return (
    <>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn("pim-qty-slider w-full h-1.5 bg-gri-200 rounded-[3px]", className)}
      />
      <style>{`
        .pim-qty-slider {
          -webkit-appearance: none;
          appearance: none;
          outline: none;
        }
        .pim-qty-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-lacivert);
          border: 4px solid white;
          box-shadow: 0 1px 6px rgba(31, 41, 55, 0.25);
          cursor: pointer;
          transition: transform 100ms;
        }
        .pim-qty-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .pim-qty-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-lacivert);
          border: 4px solid white;
          box-shadow: 0 1px 6px rgba(31, 41, 55, 0.25);
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
