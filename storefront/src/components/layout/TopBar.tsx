"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { PimAsset } from "@/components/PimAsset";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { customerCartCount } from "@/lib/customer-cart";

const NAV_ITEMS = [
  { href: "/", label: "Anasayfa" },
  { href: "/etiket", label: "Etiket" },
  { href: "/sticker", label: "Sticker" },
  { href: "/panelim", label: "Panelim" },
  { href: "/hakkimizda", label: "Hakkımızda" },
];

export function TopBar() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCartCount(customerCartCount());
    refresh();
    window.addEventListener("pim_customer_cart_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pim_customer_cart_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-black/[0.06]">
      <div className="mx-auto max-w-[1280px] px-8 h-16 flex items-center gap-8">
        {/* Combination mark — mascot + wordmark */}
        <Link href="/" aria-label="Pim Etiket — Anasayfa" className="shrink-0">
          <PimAsset variant="logo" size={200} bob={false} />
        </Link>

        {/* Nav */}
        <nav className="flex-1 flex gap-1 items-center">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3.5 py-2 rounded-full text-[14.5px] font-medium transition-colors",
                  active
                    ? "bg-lacivert text-white"
                    : "text-gri-700 hover:bg-gri-100 hover:text-lacivert"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex gap-1 items-center">
          <button
            type="button"
            aria-label="Ara"
            className="p-2.5 rounded-full text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            <Icon.Search size={18} />
          </button>
          <Link
            href="/sepet"
            aria-label={
              cartCount > 0 ? `Sepet, ${cartCount} ürün` : "Sepet, boş"
            }
            className="relative p-2.5 rounded-full text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            <Icon.Cart size={18} />
            {cartCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 grid place-items-center w-4 h-4 rounded-full bg-pim-mercan text-white text-[10px] font-bold tabular-nums"
              >
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="ml-1.5"
            href="/auth"
          >
            <Icon.User size={14} /> Giriş
          </Button>
        </div>
      </div>
    </header>
  );
}
