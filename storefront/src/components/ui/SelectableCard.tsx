"use client";

import type { ButtonHTMLAttributes, ReactNode, CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

interface SelectableCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  selected: boolean;
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
  /** Sağ üst köşedeki coral check rozetini gizle. Multi-select kartlarda
   *  iç checkbox kullanılıyorsa çift tik görünmesin diye. (Sefa 15 May v3) */
  hideCheckmark?: boolean;
}

/**
 * Seçilebilir kart (material, coating, shape gibi seçimler için).
 * Selected state: mercan border + 3px outer ring + sağ üstte tick rozeti.
 *
 * v1-jsx'in `.selectable` CSS class'ının React + Tailwind 4 versiyonu.
 * "use client" çünkü onClick interactivity gerek.
 */
export function SelectableCard({
  selected,
  children,
  padding = 14,
  style = {},
  className,
  hideCheckmark = false,
  ...rest
}: SelectableCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      style={{ padding, ...style }}
      className={cn(
        // Sefa 18 May v68: h-full eklendi → grid içinde tüm kartlar
        // eşit yükseklik alır (auto-stretch). UX uzman feedback'i: eşit
        // yükseklik için içerik miktarından bağımsız sabit kart yüksekliği.
        "relative w-full h-full bg-white text-left rounded-[12px] cursor-pointer",
        "ring-[1.5px] ring-gri-200",
        "transition-[box-shadow,transform,border-color] duration-200",
        "hover:ring-pim-mercan-soft hover:-translate-y-0.5",
        selected &&
          "ring-pim-mercan shadow-[0_0_0_3px_var(--color-pim-mercan-tint)]",
        className
      )}
    >
      {children}
      {!hideCheckmark && (
        <span
          aria-hidden
          className={cn(
            "absolute top-2 right-2 grid place-items-center w-[22px] h-[22px] rounded-full bg-pim-mercan text-white",
            "transition-[opacity,transform] duration-200",
            selected ? "opacity-100 scale-100" : "opacity-0 scale-50"
          )}
        >
          <Icon.Check size={11} />
        </span>
      )}
    </button>
  );
}
