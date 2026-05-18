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
      {/* Sefa 18 May v68 (UX uzman analizi 2.2): Locked state WCAG 1.4.3
          ihlali düzeltildi. Eski: header opacity 0.6 + content opacity 0.4
          (kontrast ~2:1 fail). Yeni: header tam opaklık (lock mesajı net),
          content opacity 0.55 (~5:1 ≥ 4.5:1 hedefi). Lock ikonu kart-içi
          değil, başlık satırına amber-ring ile belirgin. */}
      <div className="flex items-center gap-3 mb-3.5">
        {numbered && (
          <span
            aria-hidden
            className={cn(
              "grid place-items-center w-7 h-7 rounded-full font-bold text-[13px] shrink-0 transition-colors",
              locked
                ? "bg-saman text-saman-koyu ring-1 ring-saman-koyu/30"
                : "bg-lacivert text-white"
            )}
          >
            {locked ? "🔒" : number}
          </span>
        )}
        <div className="flex-1">
          <div className={cn("font-semibold text-lacivert", numbered ? "text-base" : "text-[15px]")}>
            {title}
          </div>
          {hint && !locked && (
            <div className="text-[13px] text-gri-700 mt-0.5">{hint}</div>
          )}
          {locked && lockMessage && (
            <div className="text-[12.5px] text-saman-koyu mt-0.5 font-medium">
              {lockMessage}
            </div>
          )}
        </div>
      </div>
      {/* Locked iken içerik tıklanamaz; WCAG kontrast için opacity 0.6
          (eski 0.4 fail idi). Metinler hala okunabilir kontrast'ta. */}
      <div
        className={cn(
          locked && "opacity-60 pointer-events-none select-none"
        )}
        aria-hidden={locked || undefined}
      >
        {children}
      </div>
    </Card>
  );
}
