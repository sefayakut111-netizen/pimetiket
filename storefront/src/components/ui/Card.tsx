import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: number | string; // tailwind p-* token (default: p-5)
}

export function Card({
  children,
  padding = "p-5",
  className,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04]",
        typeof padding === "string" ? padding : undefined,
        className
      )}
      style={typeof padding === "number" ? { padding } : rest.style}
    >
      {children}
    </div>
  );
}
