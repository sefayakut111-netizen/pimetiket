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
  /** Sefa 18 May v51: Önceki adım tamamlanmadıysa locked.
   *  Kart yarı saydam + tıklanamaz + üstte küçük "🔒 Önce X adımını
   *  tamamla" mesajı. */
  locked?: boolean;
  /** Locked iken gösterilen mesaj. */
  lockMessage?: string;
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
  locked,
  lockMessage,
}: FormSectionProps) {
  const numbered = number != null;
  // scroll-mt-[140px]: stepper sticky offset (72px) + stepper yüksekliği
  // (~60px) + padding → tıklanınca section başlığı stepper'ın altına
  // değil, biraz aşağı düşsün ki header'la kaybolmasın.
  return (
    <Card
      padding="p-5"
      className={cn("scroll-mt-[140px] relative", className)}
      id={id}
      aria-disabled={locked || undefined}
    >
      <div
        className={cn(
          "flex items-center gap-3 mb-3.5",
          locked && "opacity-60"
        )}
      >
        {numbered && (
          <span
            aria-hidden
            className={cn(
              "grid place-items-center w-7 h-7 rounded-full font-bold text-[13px] shrink-0",
              locked
                ? "bg-gri-200 text-gri-500"
                : "bg-lacivert text-white"
            )}
          >
            {locked ? "🔒" : number}
          </span>
        )}
        <div className="flex-1">
          <div className={cn("font-semibold", numbered ? "text-base" : "text-[15px]")}>
            {title}
          </div>
          {hint && !locked && (
            <div className="text-[13px] text-gri-700 mt-0.5">{hint}</div>
          )}
          {locked && lockMessage && (
            <div className="text-[12.5px] text-saman-koyu mt-0.5">
              {lockMessage}
            </div>
          )}
        </div>
      </div>
      {/* Locked iken içerik tıklanamaz + soluk */}
      <div
        className={cn(
          locked && "opacity-40 pointer-events-none select-none"
        )}
        aria-hidden={locked || undefined}
      >
        {children}
      </div>
    </Card>
  );
}
