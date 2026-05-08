import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: ReactNode;
}

interface ButtonAsButton
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  href?: never;
}

interface ButtonAsLink extends CommonProps {
  href: string;
  // İsteğe bağlı: yeni sekme açtırma vs için target/rel
  target?: string;
  rel?: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-pim-mercan text-white shadow-mercan hover:bg-pim-mercan-koyu hover:-translate-y-0.5",
  secondary:
    "bg-white text-lacivert ring-[1.5px] ring-lacivert hover:bg-lacivert hover:text-white hover:-translate-y-0.5",
  ghost: "bg-transparent text-lacivert hover:bg-gri-100",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-base",
};

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    block = false,
    className,
    children,
  } = props;

  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none",
    "transition-all duration-150 ease-out",
    "active:translate-y-0 active:scale-[0.99]",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    block && "w-full",
    className
  );

  // href verildiyse <Link> olarak render et
  if ("href" in props && props.href) {
    const { href, target, rel, ...rest } = props as ButtonAsLink & {
      [key: string]: unknown;
    };
    void rest;
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {children}
      </Link>
    );
  }

  // Aksi takdirde standart <button>
  const {
    variant: _v,
    size: _s,
    block: _b,
    className: _c,
    children: _ch,
    ...buttonRest
  } = props as ButtonAsButton & { [key: string]: unknown };
  void _v;
  void _s;
  void _b;
  void _c;
  void _ch;

  return (
    <button {...(buttonRest as ButtonHTMLAttributes<HTMLButtonElement>)} className={classes}>
      {children}
    </button>
  );
}
