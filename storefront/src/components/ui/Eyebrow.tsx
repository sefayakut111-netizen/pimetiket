import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Section üst etiketi. Coral renk + 18px başlangıç çizgisi.
 *
 *   ─── TÜRKİYE'NİN AKILLI DİJİTAL BASKISI
 */
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        "text-xs font-bold uppercase tracking-[0.08em] text-pim-mercan",
        className
      )}
    >
      <span aria-hidden className="w-[18px] h-0.5 bg-current rounded" />
      {children}
    </span>
  );
}
