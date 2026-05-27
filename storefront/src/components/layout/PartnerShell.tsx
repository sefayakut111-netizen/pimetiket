"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PimAsset } from "@/components/PimAsset";
import { PartnerPreviewBanner } from "@/components/layout/PartnerPreviewBanner";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

const PARTNER_NAV = [
  { href: "/partner", label: "Özet", icon: Icon.Home, exact: true },
  { href: "/partner/siparisler", label: "İşlerim", icon: Icon.Package, exact: false },
  { href: "/partner/ayarlar", label: "Ayarlar", icon: Icon.Cog, exact: false },
] as const;

export function PartnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Partner");
  const [loggingOut, setLoggingOut] = useState(false);

  const isLogin = pathname === "/partner/giris";

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/partner/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { contact?: { name?: string }; company?: { name?: string } } | null) => {
        if (!j) return;
        setDisplayName(
          j.contact?.name?.trim() || j.company?.name?.trim() || "Partner"
        );
      })
      .catch(() => {});
  }, [isLogin]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/partner/giris");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gri-50">
      <PartnerPreviewBanner />

      {/* Üst partner header — site TopBar yok */}
      <header className="sticky top-0 z-30 border-b border-gri-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-4 lg:pl-[calc(248px+1rem)]">
          <button
            type="button"
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-lacivert hover:bg-gri-100"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menüyü aç"
          >
            <Icon.Menu size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <PimAsset variant="icon" bg="light" size={24} bob={false} />
            <span className="truncate text-[14px] font-semibold text-lacivert">
              Partner Paneli
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline text-[13px] font-medium text-gri-700 truncate max-w-[160px]">
              {displayName}
            </span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] font-semibold text-gri-700 ring-1 ring-gri-200 hover:bg-gri-50 disabled:opacity-60"
            >
              {loggingOut ? "…" : "Çıkış"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}

        <aside
          className={cn(
            "fixed top-0 left-0 z-50 flex h-screen w-[248px] flex-col bg-lacivert text-white transition-transform duration-200",
            "lg:translate-x-0",
            drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
            <Link href="/partner" className="flex items-center gap-2.5 font-semibold text-[15px]">
              <PimAsset variant="icon" bg="dark" size={28} bob={false} />
              <span className="leading-tight">
                Pim Etiket
                <span className="block text-[10px] font-normal text-white/60">
                  Partner Paneli
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="ml-auto lg:hidden text-white/70 hover:text-white"
              aria-label="Menüyü kapat"
            >
              <Icon.X size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {PARTNER_NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);
                const NavIcon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-white font-semibold text-lacivert"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <NavIcon size={16} className="shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
            <a
              href="mailto:info@pimetiket.com"
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] text-white/80 hover:bg-white/10"
            >
              Yardım
            </a>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold text-white/90 hover:bg-white/10 disabled:opacity-60"
            >
              Çıkış
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:ml-[248px]">{children}</main>
      </div>

      {/* Mobil alt nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-gri-200 bg-white lg:hidden"
        aria-label="Partner mobil menü"
      >
        <div className="grid grid-cols-3">
          {PARTNER_NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            const NavIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold",
                  active ? "text-pim-mercan" : "text-gri-600"
                )}
              >
                <NavIcon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
