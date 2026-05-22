"use client";

/**
 * AdminShell — admin paneli için kalıcı sol sidebar + üst ince çubuk.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │ Sidebar │ Topbar (sayfa başlığı...)   │
 *   │  Brand  │─────────────────────────────│
 *   │  Nav 1  │                             │
 *   │  Nav 2  │  Main content (children)    │
 *   │   ...   │                             │
 *   │  User   │                             │
 *   └──────────────────────────────────────┘
 *
 * - Desktop (lg+): sidebar 248px sabit, sol tarafta görünür
 * - Mobile: sidebar drawer olarak hamburger ile açılır
 *
 * Sidebar gruplandı:
 *   - Operasyon (Dashboard / Sipariş / Manuel ekle / AI QC / Prova / Fason)
 *   - Müşteri (Müşteri / Yorum / İade)
 *   - Yönetim (Kupon / Çalışan / Fiyat hesapla)
 *   - Sistem (Rapor / Audit / Ayarlar)
 *
 * Badge'ler: aktif sipariş, AI QC kuyruğu, prova bekleyen, fason
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PimAsset } from "@/components/PimAsset";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  AdminCommandPalette,
  type CommandItem,
} from "@/components/admin/AdminCommandPalette";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";

interface AdminBadges {
  active: number;
  aiQc: number;
  proof: number;
  fason: number;
  // Sefa 16 May v3 — Domain denetçi agent sistemi
  auditorsPending: number;
  auditorsCritical: number;
  // Sefa 22 May v68 Faz 4 — Proof yardım ticket'ları (open + in_progress)
  helpRequests: number;
}

function aggregateBadges(
  orders: CustomerOrder[],
  auditorsPending: number = 0,
  auditorsCritical: number = 0,
  helpRequests: number = 0
): AdminBadges {
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
  return {
    active,
    aiQc,
    proof,
    fason,
    auditorsPending,
    auditorsCritical,
    helpRequests,
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  badgeAccent?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Sayfa başlığı çıkarımı (path → human title)
const PATH_TITLES: Record<string, string> = {
  "/admin": "Operatör paneli",
  "/admin/siparisler": "Siparişler",
  "/admin/siparis-ekle": "Manuel sipariş ekle",
  "/admin/ai-qc": "AI QC kuyruğu",
  "/admin/prova": "Prova akışı",
  "/admin/fason": "Üretim Partnerleri",
  "/admin/musteriler": "Müşteriler",
  "/admin/finans": "Finans — Mali tablo",
  "/admin/tasarimlar": "Tasarım kütüphanesi",
  "/admin/aboneler": "Email aboneleri",
  "/admin/gorseller": "Site görselleri",
  "/admin/yorumlar": "Yorumlar",
  "/admin/iadeler": "İade talepleri",
  "/admin/kuponlar": "Kuponlar",
  "/admin/calisanlar": "Çalışanlar",
  "/admin/fiyat-hesapla": "🏷 Sticker fiyat hesabı",
  "/admin/fiyat-hesapla-etiket": "📋 Rulo etiket fiyat hesabı",
  "/admin/fiyat-hesapla-tabaka": "📄 Tabaka etiket fiyat hesabı",
  "/admin/raporlar": "Raporlar",
  "/admin/audit-log": "Denetim kaydı",
  "/admin/kvkk-talepleri": "KVKK talepleri",
  "/admin/yedekler": "Yedekler",
  "/admin/galeri": "Galeri yönetimi",
  "/admin/urunler": "Ürün kartları",
  "/admin/kargo": "Kargo yönetimi",
  "/admin/ayarlar": "Ayarlar",
};

function getPageTitle(pathname: string): string {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  // /admin/foo/bar → "Foo / Bar" (Sefa 21 May v68 P2 #17: capitalize)
  const segs = pathname.split("/").filter(Boolean).slice(1);
  if (segs.length === 0) return "Operatör paneli";
  return segs
    .map((s) => s.replace(/-/g, " "))
    .map((s) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1))
    .join(" / ");
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [badges, setBadges] = useState<AdminBadges>({
    active: 0,
    aiQc: 0,
    proof: 0,
    fason: 0,
    auditorsPending: 0,
    auditorsCritical: 0,
    helpRequests: 0,
  });
  const [switching, setSwitching] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Sefa 18 May v68 (CRO denetim): Cmd+K global arama palette
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const switchToCustomer = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "customer" }),
      });
      if (res.ok) {
        router.push("/panelim");
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    let auditorCounts = { pending: 0, critical: 0 };
    let adminOrders: CustomerOrder[] = [];
    let helpRequestsCount = 0;

    // Sefa 21 May v68 (site denetim P2 #13): Sidebar badge'i admin-wide
    // /api/admin/orders/list'ten çeker; daha önce listCustomerOrders
    // local cache döndüğü için badge sayfa-bazlı tutarsız görünüyordu.
    const fetchAdminOrders = async () => {
      try {
        const res = await fetch("/api/admin/orders/list?limit=500", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { orders?: CustomerOrder[] };
        adminOrders = json.orders ?? [];
        refresh();
      } catch {
        // sessiz — fallback olarak local cache okumaya geri dön
        adminOrders = listCustomerOrders();
        refresh();
      }
    };

    const refresh = () => {
      setBadges(
        aggregateBadges(
          adminOrders,
          auditorCounts.pending,
          auditorCounts.critical,
          helpRequestsCount
        )
      );
    };

    void fetchAdminOrders();
    const ordersInterval = setInterval(fetchAdminOrders, 60_000);
    window.addEventListener("pim_customer_orders_updated", fetchAdminOrders);

    // Sefa 16 May v3: Auditor pending count'u 60sn'de bir çek.
    // /api/admin/auditors response içinde pending özet var.
    const fetchAuditorCounts = async () => {
      try {
        const res = await fetch("/api/admin/auditors", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          pending?: {
            totalPending?: number;
            criticalPending?: number;
          };
        };
        if (json.ok && json.pending) {
          auditorCounts = {
            pending: json.pending.totalPending ?? 0,
            critical: json.pending.criticalPending ?? 0,
          };
          refresh();
        }
      } catch {
        // sessiz
      }
    };
    void fetchAuditorCounts();
    const interval = setInterval(fetchAuditorCounts, 60_000);

    // Sefa 22 May v68 Faz 4 — Proof yardım ticket sayısı (open + in_progress)
    const fetchHelpRequests = async () => {
      try {
        const res = await fetch("/api/admin/help-requests?status=active", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { items?: Array<{ id: string }> };
        helpRequestsCount = json.items?.length ?? 0;
        refresh();
      } catch {
        // sessiz
      }
    };
    void fetchHelpRequests();
    const helpInterval = setInterval(fetchHelpRequests, 60_000);

    return () => {
      window.removeEventListener("pim_customer_orders_updated", fetchAdminOrders);
      clearInterval(interval);
      clearInterval(ordersInterval);
      clearInterval(helpInterval);
    };
  }, []);

  // Pathname değişince mobile drawer kapansın
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Drawer açıkken body scroll kilitle (mobile)
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: "Operasyon",
        items: [
          { href: "/admin", label: "Dashboard", icon: <Icon.Home size={16} /> },
          {
            href: "/admin/siparisler",
            label: "Siparişler",
            icon: <Icon.Box size={16} />,
            badge: badges.active,
          },
          {
            href: "/admin/siparis-ekle",
            label: "Manuel sipariş",
            icon: <Icon.Plus size={16} />,
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
            href: "/admin/kargo",
            label: "Kargo",
            icon: <Icon.Truck size={16} />,
          },
          {
            href: "/admin/fason",
            label: "Üretim Partnerleri",
            icon: <Icon.Truck size={16} />,
            badge: badges.fason,
          },
        ],
      },
      {
        label: "Müşteri",
        items: [
          {
            href: "/admin/musteriler",
            label: "Müşteriler",
            icon: <Icon.Users size={16} />,
          },
          {
            href: "/admin/yorumlar",
            label: "Yorumlar",
            icon: <Icon.Star size={16} />,
          },
          {
            href: "/admin/iadeler",
            label: "İadeler",
            icon: <Icon.Info size={16} />,
          },
          {
            href: "/admin/tasarimlar",
            label: "Tasarımlar",
            icon: <Icon.Doc size={16} />,
          },
          // Sefa 22 May v68 Faz 4 — Uzman akışı: proof yardım ticket'ları
          {
            href: "/admin/yardim-talepleri",
            label: "Yardım Talepleri",
            icon: <Icon.ChatBubble size={16} />,
            badge: badges.helpRequests,
            badgeAccent: badges.helpRequests > 0,
          },
        ],
      },
      // Sefa 18 May v68 (admin UX denetim — yeni İÇERİK grubu):
      // Galeri/Site Görselleri Müşteri'de yanlış kategorize idi.
      // İçerik editörü (Persona D) için tek grup altında.
      {
        label: "İçerik",
        items: [
          // Sefa 21 May v68 Mig 074: Ürün kartları yönetimi
          {
            href: "/admin/urunler",
            label: "Ürünler",
            icon: <Icon.Tag size={16} />,
          },
          {
            href: "/admin/aboneler",
            label: "Aboneler",
            icon: <Icon.ChatBubble size={16} />,
          },
          {
            href: "/admin/galeri",
            label: "Galeri",
            icon: <Icon.Sparkle size={16} />,
          },
          {
            href: "/admin/gorseller",
            label: "Site Görselleri",
            icon: <Icon.Box size={16} />,
          },
        ],
      },
      {
        label: "Yönetim",
        items: [
          {
            href: "/admin/finans",
            label: "Finans",
            icon: <Icon.Wallet size={16} />,
          },
          {
            href: "/admin/kuponlar",
            label: "Kuponlar",
            icon: <Icon.Tag size={16} />,
          },
          {
            href: "/admin/calisanlar",
            label: "Çalışanlar",
            icon: <Icon.User size={16} />,
          },
          // Sefa 17 May v5: Tek link "Fiyat hesapla", sayfada 3 profil tab
          // (Sticker / Rulo Etiket / Tabaka Etiket).
          {
            href: "/admin/fiyat-hesapla",
            label: "Fiyat hesapla",
            icon: <Icon.Bolt size={16} />,
          },
        ],
      },
      {
        label: "Sistem",
        items: [
          // Sefa 16 May v3 — Domain denetçi agent dashboard'u.
          // Bekleyen aksiyon sayısı badge'inde gösterilir (kritikler kırmızı).
          {
            href: "/admin/denetciler",
            label: "Denetçiler",
            icon: <Icon.Sparkle size={16} />,
            badge: badges.auditorsPending,
            badgeAccent: badges.auditorsCritical > 0,
          },
          {
            href: "/admin/raporlar",
            label: "Raporlar",
            icon: <Icon.Doc size={16} />,
          },
          {
            href: "/admin/audit-log",
            label: "Denetim kaydı",
            icon: <Icon.Refresh size={16} />,
          },
          {
            href: "/admin/kvkk-talepleri",
            label: "KVKK talepleri",
            icon: <Icon.Info size={16} />,
          },
          {
            href: "/admin/yedekler",
            label: "Yedekler",
            icon: <Icon.Box size={16} />,
          },
          // Sefa 18 May: R2 Cold Storage arşiv yönetimi
          {
            href: "/admin/arsiv",
            label: "Arşiv (R2)",
            icon: <Icon.Box size={16} />,
          },
          // Sefa 17 May: E2E sipariş simülatörü
          // Sefa 18 May v68 (admin UX denetim): NEXT_PUBLIC_ALLOW_SIMULATOR
          // flag ile production'da menüden gizlenir, yanlışlıkla tıklanmasın.
          ...(process.env.NEXT_PUBLIC_ALLOW_SIMULATOR === "true"
            ? [
                {
                  href: "/admin/test-siparis-simulator",
                  label: "Sipariş simülatörü",
                  icon: <Icon.Refresh size={16} />,
                },
              ]
            : []),
          // Sefa 17 May: Fiyat Yönetimi (Migration 047)
          {
            href: "/admin/fiyatlar",
            label: "Fiyat yönetimi",
            icon: <Icon.Sparkle size={16} />,
          },
          {
            href: "/admin/ayarlar",
            label: "Ayarlar",
            icon: <Icon.Cog size={16} />,
          },
          // Sefa 18 May v68 (admin UX denetim — KVKK m.12 2FA)
          {
            href: "/admin/profil",
            label: "Profilim & 2FA",
            icon: <Icon.User size={16} />,
          },
        ],
      },
    ],
    [badges]
  );

  const pageTitle = getPageTitle(pathname);

  // Sefa 18 May v68: navGroups → flat commandItems (palette için)
  const commandItems: CommandItem[] = useMemo(
    () =>
      navGroups.flatMap((g) =>
        g.items.map((it) => ({
          href: it.href,
          label: it.label,
          group: g.label,
          icon: it.icon,
        }))
      ),
    [navGroups]
  );

  return (
    <div className="min-h-screen bg-gri-50">
      {/* Cmd+K Command Palette */}
      <AdminCommandPalette
        items={commandItems}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — desktop sabit, mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-[248px] bg-lacivert text-white flex flex-col transition-transform duration-200",
          "lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-white/10 shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 font-semibold text-[15px]"
          >
            {/* Admin sidebar lacivert zemin → mark-light (krem icon) */}
            <PimAsset variant="icon" bg="dark" size={28} bob={false} />
            <span>Admin Panel</span>
          </Link>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden ml-auto text-white/70 hover:text-white"
            aria-label="Menüyü kapat"
          >
            <Icon.X size={18} />
          </button>
        </div>

        {/* Sefa 18 May v68 (CRO denetim): Sidebar üstünde Cmd+K arama butonu */}
        <div className="px-3 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors text-left"
          >
            <span className="text-white/60 text-[13px]">🔍</span>
            <span className="flex-1 text-[12.5px] text-white/60">
              Sayfa ara...
            </span>
            <kbd className="text-[10px] font-semibold text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav (scrollable) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/50">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      pathname.startsWith(item.href + "/"));
                  const showBadge = item.badge != null && item.badge > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13.5px] font-medium transition-colors",
                          active
                            ? "bg-white text-lacivert font-semibold"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {showBadge && (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums shrink-0",
                              item.badgeAccent
                                ? "bg-pim-mercan text-white"
                                : active
                                  ? "bg-lacivert/10 text-lacivert"
                                  : "bg-white/15 text-white"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User panel + view-mode toggle */}
        <div className="border-t border-white/10 p-3 shrink-0 space-y-2">
          <button
            type="button"
            onClick={switchToCustomer}
            disabled={switching}
            className="w-full flex items-center gap-2 h-9 px-3 rounded-lg bg-pim-mercan hover:bg-pim-mercan/90 text-white text-[12.5px] font-semibold transition-colors disabled:opacity-50"
            title="Müşteri olarak gör — analiz/test için"
          >
            <Icon.Eye size={14} />
            {switching ? "…" : "Müşteri görünümü"}
            <Icon.ArrowR size={14} className="ml-auto opacity-70" />
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-pim-mercan font-bold text-[13px] shrink-0">
              S
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">Sefa</div>
              <div className="text-[10.5px] text-white/60 truncate">
                Admin · pimetiket.com
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column — desktop'ta sidebar genişliği kadar margin */}
      <div className="lg:ml-[248px] flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gri-200 h-14 px-4 lg:px-6 flex items-center gap-3 shadow-1">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-gri-700 hover:bg-gri-100"
            aria-label="Menüyü aç"
          >
            <Icon.Menu size={20} />
          </button>

          {/* Page title */}
          <h1 className="font-semibold text-[15.5px] text-lacivert truncate">
            {pageTitle}
          </h1>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full ring-1 ring-gri-200 text-[12.5px] font-semibold text-gri-700 hover:bg-gri-50"
              title="Yeni sekmede ana siteyi aç"
            >
              <Icon.ArrowR size={12} className="rotate-[-45deg]" /> Site
            </Link>
            <button
              type="button"
              onClick={switchToCustomer}
              disabled={switching}
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-pim-mercan-tint text-pim-mercan text-[12.5px] font-semibold hover:bg-pim-mercan/15 transition-colors disabled:opacity-50"
            >
              <Icon.Eye size={12} />
              {switching ? "…" : "Müşteri görünümü"}
            </button>
          </div>
        </header>

        {/* Main content */}
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {/* Sefa 18 May v68 (admin UX denetim): tutarlı breadcrumb */}
          <div className="px-4 md:px-6 lg:px-8 pt-3">
            <AdminBreadcrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
