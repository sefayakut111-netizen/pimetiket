import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

interface FormSectionProps {
  number?: number;
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** Section'a DOM id ata — IntersectionObserver / scroll-to-step için. */
  id?: string;
}

/**
 * Konfigürasyon adımı sarıcısı.
 * `number` verilirse numaralı yuvarlak rozet (etiket akışı).
 * Verilmezse numarasız sade başlık (sticker akışı).
 *
 * v1-jsx'teki Step + Section component'larını birleştirir.
 */
export function FormSection({
  number,
  title,
  hint,
  children,
  className,
  id,
}: FormSectionProps) {
  const numbered = number != null;
  // scroll-mt-[140px]: stepper sticky offset (72px) + stepper yüksekliği
  // (~60px) + padding → tıklanınca section başlığı stepper'ın altına
  // değil, biraz aşağı düşsün ki header'la kaybolmasın.
  return (
    <Card
      padding="p-5"
      className={cn("scroll-mt-[140px]", className)}
      id={id}
    >
      <div className="flex items-center gap-3 mb-3.5">
        {numbered && (
          <span
            aria-hidden
            className="grid place-items-center w-7 h-7 rounded-full bg-lacivert text-white font-bold text-[13px] shrink-0"
          >
            {number}
          </span>
        )}
        <div className="flex-1">
          <div className={cn("font-semibold", numbered ? "text-base" : "text-[15px]")}>
            {title}
          </div>
          {hint && <div className="text-[13px] text-gri-700 mt-0.5">{hint}</div>}
        </div>
      </div>
      {children}
    </Card>
  );
}
