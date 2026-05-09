"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PimAsset } from "@/components/PimAsset";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MiniCartPopup } from "@/components/layout/MiniCartPopup";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  customerCartCount,
  listCustomerCart,
  summarizeCustomerCart,
  type CustomerCartItem,
} from "@/lib/customer-cart";
import { useUser, signOut } from "@/lib/supabase/use-user";
import { useT } from "@/lib/i18n/context";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [cartSummary, setCartSummary] = useState({
    subtotal: 0,
    shipping: 0,
    total: 0,
  });
  const { user, displayName } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { href: "/", label: t.nav.home },
    { href: "/etiket", label: t.nav.etiket },
    { href: "/sticker", label: t.nav.sticker },
    { href: "/galeri", label: t.nav.gallery },
    { href: "/blog", label: t.nav.blog },
    { href: "/panelim", label: t.nav.dashboard },
  ];

  useEffect(() => {
    const refresh = () => {
      setCartCount(customerCartCount());
      setCartItems(listCustomerCart());
      const s = summarizeCustomerCart();
      setCartSummary({
        subtotal: s.subtotal,
        shipping: s.shipping,
        total: s.total,
      });
    };
    refresh();
    window.addEventListener("pim_customer_cart_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pim_customer_cart_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Pathname değişince mobile drawer kapansın
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Mobile drawer açıkken body scroll kilitle
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  // Outside click to close menu
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  const handleLogout = async () => {
    await signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const initials = displayName
    ? displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-black/[0.06]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 h-16 flex items-center gap-3 md:gap-8">
        {/* Hamburger (mobile only) */}
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label="Menü"
          aria-expanded={mobileNavOpen}
          className="md:hidden p-2 -ml-2 rounded-lg text-gri-700 hover:bg-gri-100"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            {mobileNavOpen ? (
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path d="M3 6h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>

        {/* Combination mark — mascot + wordmark */}
        <Link
          href="/"
          aria-label="Pim Etiket"
          className="shrink-0 flex-1 md:flex-none"
        >
          <PimAsset variant="logo" size={180} bob={false} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex flex-1 gap-1 items-center">
          {navItems.map((item) => {
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
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            aria-label={t.common.search}
            className="hidden sm:inline-flex p-2.5 rounded-full text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            <Icon.Search size={18} />
          </button>
          <div className="relative group">
            <Link
              href="/sepet"
              aria-label={
                cartCount > 0
                  ? `${t.nav.cart}, ${cartCount}`
                  : `${t.nav.cart}`
              }
              className="relative inline-flex p-2.5 rounded-full text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
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
            <MiniCartPopup
              items={cartItems}
              subtotal={cartSummary.subtotal}
              shipping={cartSummary.shipping}
              total={cartSummary.total}
            />
          </div>

          {user ? (
            // Logged-in: avatar + dropdown menu
            <div className="relative ml-1.5" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-full ring-1 ring-gri-200 bg-white hover:ring-pim-mercan transition-colors"
              >
                <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan text-white text-[12px] font-bold">
                  {initials || <Icon.User size={12} />}
                </span>
                <span className="hidden sm:inline text-[13px] font-semibold text-lacivert max-w-[100px] truncate">
                  {displayName?.split(" ")[0] ?? t.nav.profile}
                </span>
                <Icon.ChevR
                  size={12}
                  className={cn(
                    "hidden sm:inline transition-transform text-gri-500",
                    menuOpen && "rotate-90"
                  )}
                />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2 ring-1 ring-gri-200 overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-gri-100">
                    <div className="text-[13px] font-semibold text-lacivert truncate">
                      {displayName}
                    </div>
                    <div className="text-[11.5px] text-gri-500 truncate">
                      {user.email}
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/panelim"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-lacivert hover:bg-gri-50"
                    >
                      <Icon.Home size={14} /> {t.nav.dashboard}
                    </Link>
                    <Link
                      href="/siparislerim"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-lacivert hover:bg-gri-50"
                    >
                      <Icon.Box size={14} /> {t.nav.orders}
                    </Link>
                    <Link
                      href="/adreslerim"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-lacivert hover:bg-gri-50"
                    >
                      <Icon.Truck size={14} /> {t.nav.addresses}
                    </Link>
                    <Link
                      href="/cuzdan"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-lacivert hover:bg-gri-50"
                    >
                      <Icon.Wallet size={14} /> {t.nav.wallet}
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-kirmizi hover:bg-kirmizi/5 border-t border-gri-100"
                  >
                    <Icon.ArrowR size={14} /> {t.nav.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Logged-out: Giriş button
            <Button
              variant="secondary"
              size="sm"
              className="ml-1.5"
              href="/auth"
            >
              <Icon.User size={14} />{" "}
              <span className="hidden sm:inline">{t.nav.login}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          {/* Panel */}
          <div className="fixed inset-x-0 top-16 bg-white z-50 md:hidden border-t border-gri-200 shadow-2">
            <nav className="flex flex-col p-3 gap-1 max-h-[calc(100vh-64px)] overflow-y-auto">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-4 py-3 rounded-lg text-[15px] font-medium transition-colors",
                      active
                        ? "bg-lacivert text-white"
                        : "text-gri-700 hover:bg-gri-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="my-2 h-px bg-gri-100" />
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[13px] text-gri-700 font-semibold">
                  Dil / Language
                </span>
                <LanguageSwitcher />
              </div>
              {!user && (
                <Link
                  href="/auth"
                  className="px-4 py-3 rounded-lg text-[15px] font-semibold bg-pim-mercan text-white text-center mt-2"
                >
                  <Icon.User size={14} /> {t.nav.login}
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
