"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

interface QtySliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel?: string;
  /** Sefa 18 May v68 (UX uzman 3.8): Logaritmik tick'ler.
   *  Örn etiket için [1000, 2000, 5000, 10000, 25000, 50000] —
   *  kullanıcı slider üzerinde değer dağılımını görsel olarak görür. */
  ticks?: number[];
  /** Tick'lerin altında label gösterilsin mi (1K, 5K, 10K formatı) */
  showTickLabels?: boolean;
}

/**
 * Custom range slider — 22px lacivert thumb (4px beyaz border + soft shadow),
 * 6px gri track. Tailwind 4'te slider thumb stillemesi için inline <style>.
 *
 * Sefa 18 May v68: Opsiyonel tick'ler + tick label'ları (logaritmik dağılım
 * için görsel guide).
 */
export function QtySlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  ariaLabel = "Miktar",
  ticks,
  showTickLabels = false,
}: QtySliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    onChange(Number(e.target.value));
  const listId = useId();
  // Sefa 21 May v68 (ürün denetim P2 #22): slider tic'leri "1K/2.5K" idi,
  // preset chip'leri "1.000/2.500" — tutarsız. Slider da tr-TR formatı:
  // 1.000 / 2.500 / 10.000 (binlik nokta).
  const formatTick = (n: number): string => n.toLocaleString("tr-TR");

  return (
    <>
      <div className="w-full min-w-0 overflow-hidden">
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
          list={ticks && ticks.length > 0 ? listId : undefined}
          className={cn(
            "pim-qty-slider w-full h-1.5 bg-gri-200 rounded-[3px]",
            className
          )}
        />
        {ticks && ticks.length > 0 && showTickLabels && (
          <div
            className="relative mt-1 h-3.5 w-full overflow-hidden text-[10px] font-medium text-gri-500 tabular-nums select-none"
            aria-hidden="true"
          >
            {ticks.map((t, index) => {
              const span = max - min;
              const rawPct = span <= 0 ? 0 : ((t - min) / span) * 100;
              const pct = Math.min(100, Math.max(0, rawPct));
              const isFirst = index === 0;
              const isLast = index === ticks.length - 1;
              return (
                <span
                  key={t}
                  className={cn(
                    "absolute top-0 whitespace-nowrap",
                    isFirst && "left-0",
                    isLast && !isFirst && "right-0",
                    !isFirst && !isLast && "-translate-x-1/2"
                  )}
                  style={
                    !isFirst && !isLast
                      ? ({ left: `${pct}%` } satisfies CSSProperties)
                      : undefined
                  }
                >
                  {formatTick(t)}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {ticks && ticks.length > 0 && (
        <datalist id={listId}>
          {ticks.map((t) => (
            <option key={t} value={t} label={formatTick(t)} />
          ))}
        </datalist>
      )}
      <style>{`
        .pim-qty-slider {
          -webkit-appearance: none;
          appearance: none;
          outline: none;
        }
        /* Sefa 20 May v68: thumb dikey hizalama — track 6px high,
           thumb 22px → margin-top -8px ile track ortasına yerleşir.
           Webkit'te thumb default merkez bug'ı bazı tarayıcılarda. */
        .pim-qty-slider::-webkit-slider-runnable-track {
          height: 6px;
          background: transparent;
          border-radius: 3px;
        }
        .pim-qty-slider::-moz-range-track {
          height: 6px;
          background: transparent;
          border-radius: 3px;
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
          margin-top: -8px;
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
