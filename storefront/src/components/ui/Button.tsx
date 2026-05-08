import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-pim-mercan text-white shadow-mercan hover:bg-pim-mercan-koyu hover:-translate-y-0.5",
  secondary:
    "bg-white text-lacivert ring-[1.5px] ring-lacivert hover:bg-lacivert hover:text-white hover:-translate-y-0.5",
  ghost:
    "bg-transparent text-lacivert hover:bg-gri-100",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none",
        "transition-all duration-150 ease-out",
        "active:translate-y-0 active:scale-[0.99]",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && "w-full",
        className
      )}
    >
      {children}
    </button>
  );
}
