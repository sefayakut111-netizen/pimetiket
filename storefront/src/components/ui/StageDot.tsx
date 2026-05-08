import { cn } from "@/lib/cn";
import { Icon } from "@/components/Icon";

type Stage = "done" | "curr" | "todo";

interface StageDotProps {
  state: Stage;
  label?: string | number;
  className?: string;
}

/**
 * Sipariş timeline noktası — 28px daire.
 *   done → yeşil + tick
 *   curr → mercan + 6px outer ring
 *   todo → gri-200 bg, gri-500 text
 */
export function StageDot({ state, label, className }: StageDotProps) {
  return (
    <span
      className={cn(
        "inline-grid place-items-center w-7 h-7 rounded-full text-[13px] font-bold shrink-0",
        state === "done" && "bg-yesil text-white",
        state === "curr" &&
          "bg-pim-mercan text-white shadow-[0_0_0_6px_var(--color-pim-mercan-tint)]",
        state === "todo" && "bg-gri-200 text-gri-500",
        className
      )}
      aria-label={state === "done" ? "tamamlandı" : state === "curr" ? "şu an" : "bekliyor"}
    >
      {state === "done" ? <Icon.Check size={14} /> : label ?? ""}
    </span>
  );
}
