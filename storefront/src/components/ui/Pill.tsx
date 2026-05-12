import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PillVariant =
  | "mercan"
  | "yesil"
  | "sari"
  | "gri"
  | "lacivert"
  | "krem";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  children: ReactNode;
}

const VARIANT_CLASS: Record<PillVariant, string> = {
  mercan: "bg-pim-mercan-tint text-pim-mercan",
  yesil: "bg-yesil-soft text-yesil",
  sari: "bg-sari-soft text-sari-koyu",
  gri: "bg-gri-100 text-gri-700",
  lacivert: "bg-lacivert text-white",
  krem: "bg-krem text-lacivert",
};

export function Pill({
  variant = "gri",
  className,
  children,
  ...rest
}: PillProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full",
        "text-[12.5px] font-semibold tracking-tight",
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
