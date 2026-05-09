"use client";

/**
 * AdminShell — admin/operatör paneli için ayrı topbar.
 * Public AppShell'den ayrı: lacivert header, kompakt nav, sayaç badge'leri.
 *
 * Badge'ler customer-orders store'undan canlı okunur:
 *   - Siparişler: aktif sipariş sayısı (delivered/cancelled hariç)
 *   - AI QC: qc_flagged + operator_review toplam
 *   - Prova: proof_pending sayısı
 *   - Fason: paid + qc_pending sayısı (üretime atanacak)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PimAsset } from "@/components/PimAsset";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";

interface AdminBadges {
  active: number;
  aiQc: number;
  proof: number;
  fason: number;
}

function aggregateBadges(orders: CustomerOrder[]): AdminBadges {
  let active = 0;
  let aiQc = 0;
  let proof = 0;
  let fason = 0;
  for (const o of orders) {
    if (o.status !== "delivered" && o.status !== "cancelled") active++;
    if (o.status === "qc_flagged" || o.status === "operator_review") aiQc++;
    if (o.status === "proof_pending") proof++;
    if (o.status === "paid" || o.status === "qc_pending") fason++;
  }
  return { active, aiQc, proof, fason };
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<AdminBadges>({
    active: 0,
    aiQc: 0,
    proof: 0,
    fason: 0,
  });

  useEffect(() => {
    const refresh = () => setBadges(aggregateBadges(listCustomerOrders()));
    refresh();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const adminNav = [
    { href: "/admin", label: "Dashboard", icon: <Icon.Home size={16} /> },
    {
      href: "/admin/siparisler",
      label: "Siparişler",
      icon: <Icon.Box size={16} />,
      badge: badges.active,
    },
    {
      href: "/admin/ai-qc",
      label: "AI QC",
      icon: <Icon.Sparkle size={16} />,
      badge: badges.aiQc,
      badgeAccent: badges.aiQc > 0,
    },
    {
      href: "/admin/prova",
      label: "Prova",
      icon: <Icon.Check size={16} />,
      badge: badges.proof,
    },
    {
      href: "/admin/fason",
      label: "Fason",
      icon: <Icon.Truck size={16} />,
      badge: badges.fason,
    },
    {
      href: "/admin/iadeler",
      label: "İade",
      icon: <Icon.Info size={16} />,
    },
    {
      href: "/admin/musteriler",
      label: "Müşteri",
      icon: <Icon.User size={16} />,
    },
    {
      href: "/admin/raporlar",
      label: "Rapor",
      icon: <Icon.Star size={16} />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gri-50">
      {/* Admin TopBar */}
      <header className="sticky top-0 z-50 bg-lacivert text-white shadow-1">
        <div className="mx-auto max-w-[1280px] px-6 h-14 flex items-center gap-5">
          {/* Brand + admin label */}
          <Link
            href="/admin"
            className="flex items-center gap-2.5 font-semibold text-[15px] shrink-0"
          >
            <span className="bg-white rounded p-0.5">
              <PimAsset variant="icon" size={28} bob={false} />
            </span>
            <span className="hidden sm:inline">Admin Panel</span>
          </Link>

          {/* Nav */}
          <nav className="flex-1 flex gap-0.5 items-center overflow-x-auto">
            {adminNav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const showBadge = item.badge != null && item.badge > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors",
                    active
                      ? "bg-white text-lacivert"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {item.icon}
                  {item.label}
                  {showBadge && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ml-0.5 tabular-nums",
                        item.badgeAccent
                          ? "bg-pim-mercan text-white"
                          : active
                            ? "bg-lacivert text-white"
                            : "bg-white/15 text-white"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="text-[12.5px] text-white/70 hover:text-white hidden md:inline"
            >
              ↗ Müşteri görünümü
            </Link>
            <span className="hidden sm:inline-flex items-center gap-2 text-[13px]">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan font-bold text-[12px]">
                S
              </span>
              <span className="font-semibold">Sefa</span>
            </span>
          </div>
        </div>
      </header>

      <div id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
    </div>
  );
}
