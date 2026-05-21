import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      className={cn(
        "block w-full h-12 px-3.5 rounded-[12px]",
        "bg-white text-[15px] font-medium text-lacivert",
        "ring-1 ring-gri-200",
        "placeholder:text-gri-500",
        "focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)]",
        "transition-shadow duration-150",
        "disabled:opacity-50 disabled:bg-gri-50",
        className
      )}
    />
  )
);

Input.displayName = "Input";
