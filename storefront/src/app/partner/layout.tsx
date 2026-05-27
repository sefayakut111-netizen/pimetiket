"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/partner", label: "Özet", exact: true },
  { href: "/partner/siparisler", label: "Siparişlerim", exact: false },
] as const;

export function PartnerSubNav() {
  const pathname = usePathname();

  if (pathname === "/partner/giris") return null;

  return (
    <nav
      className="border-b border-gri-200 bg-white"
      aria-label="Partner paneli"
    >
      <div className="container flex gap-1 py-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-[40px] items-center rounded-lg px-4 text-[13px] font-semibold transition-colors",
                active
                  ? "bg-pim-mercan-tint text-pim-mercan"
                  : "text-gri-700 hover:bg-gri-50 hover:text-lacivert"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PartnerSubNav />
      {children}
    </>
  );
}
