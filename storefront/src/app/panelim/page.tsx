/**
 * Pim Etiket — /panelim (E.2.2)
 *
 * Customer dashboard. customer-orders store'undan canlı veri okur:
 *   - Aktif siparişler (delivered/cancelled hariç) tümü
 *   - "Bu yıl basıldı" toplamı qty üzerinden
 *   - Quick re-order: en son etiket/sticker siparişi
 *
 * Cüzdan KALDIRILDI (Migration 015, 10 May 2026). Tasarım kütüphanesi
 * /tasarimlarim sayfasında — auth + storage canlı.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import {
  listCustomerOrders,
  refreshCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { reorderFromOrder } from "@/lib/customer-reorder";
import { getMyProfile } from "@/lib/customer-profile";
import type { OrderStatus } from "@/lib/order";
import { useT } from "@/lib/i18n/context";
import { NotificationsMini } from "@/components/customer/NotificationsMini";
import { PanelimAdditionalDesignsRow, PanelimPrimaryPreview } from "@/components/orders/PanelimOrderPreviews";
import {
  orderHasMetaPreviews,
  prefetchOrderDesignFiles,
  type OrderDesignFilesMap,
} from "@/lib/order-design-previews";

const COPY = {
  tr: {
    phases: [
      "Konfigüre",
      "Ödendi",
      "Yüklendi",
      "AI kontrol",
      "Onay",
      "Üretim",
      "Kargo",
      "Teslim",
    ],
    statusInControl: "Kontrolde",
    statusProofPending: "Onay bekliyor",
    statusInProduction: "Üretimde",
    statusShipped: "Kargoda",
    statusDelivered: "Teslim edildi",
    statusCancelled: "İptal",
    helloShort: "Hoş geldin",
    helloWith: (name: string) => `Hoş geldin, ${name} 👋`,
    helloEmpty: "Hoş geldin 👋",
    activeNone: "Henüz aktif siparişin yok. Pim seninle bir tur atmak için sabırsızlanıyor.",
    activeSummary: (active: number, prod: number, shipped: number) => {
      const parts: string[] = [`${active} aktif siparişin var.`];
      if (prod > 0) parts.push(`${prod} tanesi üretimde.`);
      if (shipped > 0) parts.push(`${shipped} tanesi kargoda.`);
      return parts.join(" ");
    },
    statActive: "Aktif sipariş",
    statActiveSubReady: "Yeni sipariş için hazır",
    statActiveSubBusy: (prod: number, shipped: number) =>
      `${prod} üretimde, ${shipped} kargoda`,
    statPrintedYear: (year: number) => `${year} basıldı`,
    statPrintedSub: "adet etiket + sticker",
    qaNewEtiket: "Yeni etiket",
    qaNewEtiketDesc: "1000 adetten başla",
    qaNewSticker: "Yeni sticker",
    qaNewStickerDesc: "25 adetten başla",
    qaReorder: "Son siparişi tekrar et",
    qaReorderLast: (summary: string) => summary,
    qaReorderSoon: "Henüz sipariş yok",
    qaReorderRepeat: "Tekrarla",
    activeOrdersTitle: "Aktif siparişler",
    seeAll: "Tümünü gör",
    activeEmptyTitle: "Aktif sipariş yok",
    activeEmptyDesc:
      "Yeni bir etiket veya sticker konfigüre etmeye başla — sipariş verdiğinde burada görünecek.",
    printEtiket: "Etiket bastır",
    printSticker: "Sticker bastır",
    multiOrder: (n: number) => `${n} ürünlük sipariş`,
    mixed: "Karışık",
    pcs: "adet",
    detail: "Detay",
    profileSettings: { t: "Profil ayarları", d: "Ad, e-posta, şifre" },
    addressBook: { t: "Adres defterim", d: "Teslim ve fatura adresleri" },
    invoiceInfo: { t: "Fatura bilgileri", d: "TC/VKN, e-fatura tercihi" },
    helpCenter: { t: "Yardım merkezi", d: "Pim ile sohbet" },
    pimChatTitle: "Pim'le konuş",
    pimChatSub: "Sağ alttaki balonla sohbet aç",
    pimChatDesc:
      "Soru, sipariş takibi, fiyat hesabı — Pim her zaman sayfanın sağ alt köşesinde. Tıkla, konuş.",
    locale: "tr-TR",
  },
  en: {
    phases: [
      "Configure",
      "Paid",
      "Uploaded",
      "AI check",
      "Approval",
      "Production",
      "Shipping",
      "Delivered",
    ],
    statusInControl: "In review",
    statusProofPending: "Awaiting approval",
    statusInProduction: "In production",
    statusShipped: "In transit",
    statusDelivered: "Delivered",
    statusCancelled: "Cancelled",
    helloShort: "Welcome",
    helloWith: (name: string) => `Welcome back, ${name} 👋`,
    helloEmpty: "Welcome 👋",
    activeNone:
      "No active orders yet. Pim is excited to take you on a tour.",
    activeSummary: (active: number, prod: number, shipped: number) => {
      const parts: string[] = [`You have ${active} active order${active === 1 ? "" : "s"}.`];
      if (prod > 0) parts.push(`${prod} in production.`);
      if (shipped > 0) parts.push(`${shipped} in transit.`);
      return parts.join(" ");
    },
    statActive: "Active orders",
    statActiveSubReady: "Ready for a new order",
    statActiveSubBusy: (prod: number, shipped: number) =>
      `${prod} producing, ${shipped} shipping`,
    statPrintedYear: (year: number) => `Printed in ${year}`,
    statPrintedSub: "labels + stickers",
    qaNewEtiket: "New label",
    qaNewEtiketDesc: "Start at 1000 units",
    qaNewSticker: "New sticker",
    qaNewStickerDesc: "Start at 25 units",
    qaReorder: "Repeat last order",
    qaReorderLast: (summary: string) => summary,
    qaReorderSoon: "No orders yet",
    qaReorderRepeat: "Repeat",
    activeOrdersTitle: "Active orders",
    seeAll: "See all",
    activeEmptyTitle: "No active orders",
    activeEmptyDesc:
      "Start configuring a label or sticker — once you place an order, it will appear here.",
    printEtiket: "Print labels",
    printSticker: "Print stickers",
    multiOrder: (n: number) => `Order with ${n} items`,
    mixed: "Mixed",
    pcs: "units",
    detail: "Details",
    profileSettings: { t: "Profile settings", d: "Name, email, password" },
    addressBook: { t: "Address book", d: "Shipping & invoice addresses" },
    invoiceInfo: { t: "Invoice info", d: "TC/VAT, e-invoice preference" },
    helpCenter: { t: "Help center", d: "Chat with Pim" },
    pimChatTitle: "Talk to Pim",
    pimChatSub: "Open the chat from the bubble at the bottom-right",
    pimChatDesc:
      "Questions, order tracking, price quotes — Pim is always at the bottom-right of the page. Click and chat.",
    locale: "en-US",
  },
};

/** OrderStatus → PHASES index (8 faz, 0-7) */
function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":
      return 1;
    case "awaiting_upload":
      return 2;
    case "qc_pending":
    case "qc_flagged":
    case "human_review":
    case "human_review_failed":
    case "operator_review":
      return 3;
    case "proof_generating":
    case "proof_validating":
    case "proof_pending":
      return 4;
    case "proof_approved":
    case "operator_print_review":
    case "ready_to_ship":
    case "fason_assigned":
    case "in_production":
      return 5;
    case "shipped":
      return 6;
    case "delivered":
      return 7;
    case "cancelled":
      return -1;
    default:
      return 0;
  }
}

function orderNeedsCustomerAction(status: OrderStatus): boolean {
  return (
    status === "awaiting_upload" ||
    status === "proof_pending" ||
    status === "proof_validating" ||
    status === "human_review_failed"
  );
}

function orderCustomerPhaseDone(status: OrderStatus): boolean {
  return (
    status === "proof_approved" ||
    status === "ready_to_ship" ||
    status === "fason_assigned" ||
    status === "in_production" ||
    status === "shipped"
  );
}

function OrderActionCta({
  order,
  locale,
  reordering,
  onReorder,
}: {
  order: CustomerOrder;
  locale: string;
  reordering: boolean;
  onReorder: (order: CustomerOrder) => void;
}) {
  const isEn = locale === "en";

  switch (order.status) {
    case "awaiting_upload":
      return (
        <Button
          variant="primary"
          size="sm"
          href={`/siparis/${order.id}/tasarim-yukle`}
          className="w-full"
        >
          📁 {isEn ? "Upload design" : "Tasarım yükle"}
        </Button>
      );

    case "proof_pending":
    case "proof_validating":
      return (
        <Button
          variant="primary"
          size="sm"
          href={`/onay/${order.id}`}
          className="w-full"
        >
          ✋ {isEn ? "Review and approve proof" : "Provayı incele ve onayla"}
        </Button>
      );

    case "shipped":
      return (
        <Button
          variant="secondary"
          size="sm"
          href={`/siparis/${order.id}`}
          className="w-full"
        >
          📦 {isEn ? "Track shipment →" : "Kargo takip et →"}
        </Button>
      );

    case "delivered":
      return (
        <div className="flex gap-2 w-full">
          <Button
            variant="secondary"
            size="sm"
            href={`/yorum-yaz/${order.id}`}
            className="flex-1"
          >
            ⭐ {isEn ? "Write review" : "Yorum yaz"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReorder(order)}
            disabled={reordering}
            className="flex-1"
          >
            🔄 {isEn ? "Reorder" : "Tekrarla"}
          </Button>
        </div>
      );

    case "qc_pending":
    case "human_review":
      return (
        <div className="flex items-center gap-2 text-[12px] text-gri-500">
          <span className="w-3 h-3 rounded-full bg-sari animate-pulse shrink-0" />
          {isEn
            ? "AI check in progress — results in a few minutes"
            : "AI ön-kontrol yapılıyor — birkaç dakika içinde sonuç çıkacak"}
        </div>
      );

    case "proof_generating":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[12px] text-gri-500">
            <span className="w-3 h-3 rounded-full bg-pim-mercan animate-pulse shrink-0" />
            {isEn
              ? "Cut line being prepared..."
              : "Bıçak çizimi hazırlanıyor..."}
          </div>
          <Button
            variant="primary"
            size="sm"
            href={`/onay/${order.id}`}
            className="w-full"
          >
            {isEn ? "View proof preparation →" : "Prova hazırlığını gör →"}
          </Button>
        </div>
      );

    case "human_review_failed":
      return (
        <Button
          variant="primary"
          size="sm"
          href={`/siparis/${order.id}/tasarim-yukle`}
          className="w-full !bg-pim-mercan"
        >
          ⚠️{" "}
          {isEn
            ? "Fix design and re-upload"
            : "Tasarımını düzelt ve tekrar yükle"}
        </Button>
      );

    case "in_production":
      return (
        <div className="text-[12px] text-gri-500">
          🏭{" "}
          {isEn ? "In production — estimated shipping " : "Üretimde — tahmini "}
          {order.estimatedDelivery
            ? new Date(order.estimatedDelivery).toLocaleDateString(
                isEn ? "en-US" : "tr-TR",
                { day: "numeric", month: "long" }
              )
            : isEn
              ? "in a few days"
              : "birkaç gün içinde"}{" "}
          {isEn ? "" : "kargoda"}
        </div>
      );

    case "cancelled":
      return (
        <div className="text-[12px] text-kirmizi">
          {isEn ? "Cancelled" : "İptal edildi"}
          {order.total > 0
            ? isEn
              ? " — refund initiated"
              : " — iade işlemi başlatıldı"
            : ""}
        </div>
      );

    default:
      return null;
  }
}

function statusMeta(
  status: OrderStatus,
  c: typeof COPY.tr
): {
  label: string;
  color: string;
  soft: string;
  pim: "inspect" | "happy" | "box" | "wave";
} {
  switch (status) {
    case "awaiting_upload":
      return {
        label: "Tasarım yüklemen lazım",
        color: "var(--color-pim-mercan)",
        soft: "var(--color-pim-mercan-tint)",
        pim: "inspect",
      };
    case "paid":
    case "qc_pending":
    case "qc_flagged":
    case "operator_review":
      return {
        label: c.statusInControl,
        color: "var(--color-sari)",
        soft: "var(--color-sari-soft)",
        pim: "inspect",
      };
    case "proof_pending":
      return {
        label: c.statusProofPending,
        color: "var(--color-sari)",
        soft: "var(--color-sari-soft)",
        pim: "inspect",
      };
    case "proof_validating":
      return {
        label: "Düzenlemenizi kontrol ediyoruz",
        color: "var(--color-sari)",
        soft: "var(--color-sari-soft)",
        pim: "inspect",
      };
    case "proof_approved":
    case "operator_print_review":
      return {
        label: "Onayın alındı — üretime geçildi",
        color: "var(--color-yesil)",
        soft: "var(--color-yesil-soft)",
        pim: "happy",
      };
    case "in_production":
      return {
        label: c.statusInProduction,
        color: "var(--color-pim-mercan)",
        soft: "var(--color-pim-mercan-tint)",
        pim: "happy",
      };
    case "shipped":
      return {
        label: c.statusShipped,
        color: "var(--color-lacivert)",
        soft: "var(--color-gri-100)",
        pim: "box",
      };
    case "delivered":
      return {
        label: c.statusDelivered,
        color: "var(--color-yesil)",
        soft: "var(--color-yesil-soft)",
        pim: "wave",
      };
    case "cancelled":
      return {
        label: c.statusCancelled,
        color: "var(--color-kirmizi)",
        soft: "var(--color-gri-100)",
        pim: "inspect",
      };
    // Sefa 19 May v68: DB enum'da olup eski switch'te eksik kalan 4 değer
    case "human_review":
    case "human_review_failed":
    case "proof_generating":
    case "ready_to_ship":
    case "fason_assigned":
      return {
        label: c.statusInControl,
        color: "var(--color-sari)",
        soft: "var(--color-sari-soft)",
        pim: "inspect",
      };
  }
}

interface LoyaltyCoupon {
  id: string;
  code: string;
  kind: "percent" | "fixed" | "free_ship";
  value: number;
  max_discount: number | null;
  min_subtotal: number | null;
  expires_at: string;
  description: string | null;
}

interface LoyaltyInvited {
  id: string;
  referred_user_id: string;
  status: "pending" | "completed" | "expired";
  created_at: string;
  completed_at: string | null;
}

interface LoyaltyData {
  vipSince: string | null;
  referralCode: string | null;
  orderCount: number;
  invited: LoyaltyInvited[];
  availableCoupons: LoyaltyCoupon[];
}

export default function PanelimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  // Sefa 17 May P1-11: localStorage cache placeholder ile "Hoş geldin, ..."
  // 2-3sn boş kalma sorununu çöz. İlk render anında en son bilinen isim
  // gösterilir, profile fetch'i tamamlanınca düzenlenir.
  const [profileName, setProfileName] = useState<string | null>(null);
  const [designFilesMap, setDesignFilesMap] = useState<OrderDesignFilesMap>({});
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    // localStorage cache okumayı useEffect içinde yap (SSR uyumu)
    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem("pim_user_display_name");
        if (cached) setProfileName(cached);
      } catch {
        /* ignore */
      }
    }

    ensureAuthBindings();
    const refresh = () => setOrders(listCustomerOrders());
    void refreshCustomerOrders().then(() => {
      refresh();
      setHydrated(true);
    });
    window.addEventListener("pim_customer_orders_updated", refresh);

    // Profil fetch — isim cache'le (sonraki ziyarette anında görünsün)
    void getMyProfile().then((p) => {
      if (!p?.displayName) return;
      const first = p.displayName.split(" ")[0];
      setProfileName(first);
      try {
        window.localStorage.setItem("pim_user_display_name", first);
      } catch {
        /* ignore */
      }
    });

    // Loyalty data fetch
    fetch("/api/loyalty/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LoyaltyData | null) => data && setLoyalty(data))
      .catch(() => {
        /* silent */
      });

    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const hasWaiting = orders.some(
      (o) =>
        o.status === "qc_pending" ||
        o.status === "proof_generating" ||
        o.status === "proof_validating" ||
        o.status === "human_review"
    );
    if (!hasWaiting) return;

    const interval = setInterval(() => {
      void refreshCustomerOrders().then(() => {
        setOrders(listCustomerOrders());
      });
    }, 10000);

    const timeout = setTimeout(() => clearInterval(interval), 300000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [hydrated, orders]);

  const handleQuickReorder = async (order: CustomerOrder) => {
    setReordering(true);
    try {
      const r = await reorderFromOrder(order);
      if (r.ok) {
        toast.success(`${r.added} ürün sepete eklendi`);
        router.push("/sepet");
      } else {
        toast.error(r.reason ?? "Sepete eklenemedi");
      }
    } catch (err) {
      console.error("[panelim/reorder] failed:", err);
      toast.error("Tekrar sipariş açılamadı — sayfayı yenileyip tekrar dene.");
    } finally {
      setReordering(false);
    }
  };

  const fmt = (n: number) => Math.round(n).toLocaleString(c.locale);

  const PROFILE_LINKS = [
    { ...c.profileSettings, href: "/profil" },
    { ...c.addressBook, href: "/adreslerim" },
    { ...c.invoiceInfo, href: "/fatura-bilgileri" },
    {
      t: locale === "en" ? "My designs" : "Tasarımlarım",
      d:
        locale === "en"
          ? "Uploaded design files"
          : "Yüklenen tasarım dosyaları",
      href: "/tasarimlarim",
    },
    {
      t: locale === "en" ? "My returns" : "İadelerim",
      d:
        locale === "en"
          ? "Return requests & status"
          : "İade taleplerim ve durumu",
      href: "/iadelerim",
    },
    {
      t: locale === "en" ? "Support" : "Destek",
      d:
        locale === "en"
          ? "Create a support ticket"
          : "Destek talebi oluştur",
      href: "/destek",
    },
    {
      t: locale === "en" ? "Notifications" : "Bildirim tercihleri",
      d:
        locale === "en"
          ? "Email & SMS preferences"
          : "E-posta ve SMS ayarları",
      href: "/bildirim-tercihleri",
    },
    { ...c.helpCenter, href: "/sss" },
  ];

  // Aktif siparişler (delivered + cancelled hariç) — sayfalı
  const ORDERS_PER_PAGE = 10;
  const [orderPage, setOrderPage] = useState(1);
  const allActiveOrders = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const activeOrders = allActiveOrders.slice(0, orderPage * ORDERS_PER_PAGE);
  const hasMoreOrders = allActiveOrders.length > activeOrders.length;

  useEffect(() => {
    if (!hydrated) return;
    const recentDelivered = orders
      .filter((o) => o.status === "delivered")
      .slice(0, 2);
    const visibleActive = orders
      .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
      .slice(0, orderPage * ORDERS_PER_PAGE);
    const candidates = [...visibleActive, ...recentDelivered].filter(
      (o) => !orderHasMetaPreviews(o)
    );
    const ids = candidates.map((o) => o.id);
    if (ids.length === 0) return;
    void prefetchOrderDesignFiles(ids).then((next) => {
      setDesignFilesMap((prev) => ({ ...prev, ...next }));
    });
  }, [hydrated, orders, orderPage]);

  // Stat hesapları
  const activeCount = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  ).length;
  const inProductionCount = orders.filter(
    (o) => o.status === "in_production"
  ).length;
  const shippedCount = orders.filter((o) => o.status === "shipped").length;
  const thisYear = new Date().getFullYear();
  const thisYearTotalQty = orders
    .filter((o) => {
      try {
        return new Date(o.createdAtIso).getFullYear() === thisYear;
      } catch {
        return false;
      }
    })
    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);

  const thisYearTotalSpent = orders
    .filter((o) => {
      try {
        return new Date(o.createdAtIso).getFullYear() === thisYear;
      } catch {
        return false;
      }
    })
    .filter((o) => o.status !== "cancelled")
    .reduce(
      (sum, o) => sum + (typeof o.total === "number" ? o.total : 0),
      0
    );

  const totalOrderCount = orders.filter((o) => o.status !== "cancelled").length;

  // Selam — Sefa 17 May P1-11: profile cache > orders fallback
  // (orders yüklenmesini beklemeden anında isim göstersin)
  const customerName =
    profileName ??
    (orders.length > 0 ? orders[0].address.name.split(" ")[0] : null);

  // Tekrar sipariş — en yeni tamamlanmış sipariş (created_at DESC)
  const completedOrders = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "awaiting_upload" && o.status !== "paid"
  );
  const lastReorderTarget = completedOrders[0] ?? null;

  function reorderSummary(order: CustomerOrder): string {
    const title =
      order.items.length === 1
        ? order.items[0].title
        : c.multiOrder(order.items.length);
    const totalQty = order.items.reduce((s, i) => s + i.qty, 0);
    return `${title} · ${fmt(totalQty)} ${c.pcs}`;
  }

  // Sefa 17 May P1-5 + P2-19:
  // - Hydration error #418 — SSR'de server timezone'da date farklı dönebiliyor
  //   → client-only render. SSR'de empty string.
  // - YIL EKSİKTİ ("17 MAYIS PAZAR" → "17 MAYIS 2026 PAZAR")
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    const today = new Date();
    setDateLabel(
      today
        .toLocaleDateString(c.locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
          weekday: "long",
        })
        .toUpperCase()
    );
  }, [c.locale]);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-2xl p-5 md:p-8 mb-6 bg-gradient-to-br from-krem to-krem-soft ring-1 ring-black/[0.04]">
          <div className="absolute -top-5 right-8 hidden md:block">
            <Pim pose="wave" size={160} />
          </div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            {dateLabel}
          </div>
          <h1 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight mt-2 mb-1.5 flex items-center gap-3 flex-wrap">
            <span>
              {customerName ? c.helloWith(customerName) : c.helloEmpty}
            </span>
            {/* VIP badge kaldırıldı — müşteri sınıflandırması yok */}
          </h1>
          <p className="text-base text-gri-700">
            {!hydrated
              ? "..."
              : activeCount === 0
                ? c.activeNone
                : c.activeSummary(activeCount, inProductionCount, shippedCount)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7 max-w-[780px]">
            <Stat
              label={c.statActive}
              value={hydrated ? activeCount.toString() : "—"}
              sub={
                inProductionCount + shippedCount > 0
                  ? c.statActiveSubBusy(inProductionCount, shippedCount)
                  : c.statActiveSubReady
              }
              icon={<Icon.Box size={18} />}
              accent="text-pim-mercan"
            />
            <Stat
              label={c.statPrintedYear(thisYear)}
              value={hydrated ? fmt(thisYearTotalQty) : "—"}
              sub={c.statPrintedSub}
              icon={<Icon.Sparkle size={18} />}
              accent="text-turuncu"
            />
            <Stat
              label={
                locale === "en"
                  ? `Spent in ${thisYear}`
                  : `${thisYear} harcama`
              }
              value={hydrated ? `${fmt(thisYearTotalSpent)} ₺` : "—"}
              sub={
                locale === "en"
                  ? `${totalOrderCount} orders total`
                  : `${totalOrderCount} sipariş toplamı`
              }
              icon={<Icon.Wallet size={18} />}
              accent="text-yesil"
            />
          </div>
        </div>

        {/* Quick actions — Görev 4 ile geri getirildi */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {lastReorderTarget ? (
            <QuickAction
              icon={<Icon.Refresh size={20} />}
              title={c.qaReorder}
              desc={c.qaReorderLast(reorderSummary(lastReorderTarget))}
              onClick={() => void handleQuickReorder(lastReorderTarget)}
              disabled={reordering}
              primary
            />
          ) : (
            <QuickAction
              icon={<Icon.Refresh size={20} />}
              title={c.qaReorder}
              desc={c.qaReorderSoon}
              href="/siparislerim"
              primary
            />
          )}
          <QuickAction
            icon={<Icon.Roll size={20} />}
            title={c.qaNewEtiket}
            desc={c.qaNewEtiketDesc}
            href="/etiket"
          />
          <QuickAction
            icon={<Icon.Sticker size={20} />}
            title={c.qaNewSticker}
            desc={c.qaNewStickerDesc}
            href="/sticker"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Active orders */}
            <section>
              <div className="flex justify-between items-center mb-3.5">
                <h2 className="text-[24px] font-semibold tracking-tight">
                  {c.activeOrdersTitle}
                </h2>
                <Link
                  href="/siparislerim"
                  className="text-[13px] font-semibold text-gri-700 hover:text-pim-mercan inline-flex items-center gap-1"
                >
                  {c.seeAll} <Icon.ChevR size={12} />
                </Link>
              </div>

              {!hydrated ? (
                <div className="space-y-3">
                  <Skeleton.OrderRow />
                  <Skeleton.OrderRow />
                </div>
              ) : activeOrders.length === 0 ? (
                <Card padding="p-8" className="text-center">
                  <Pim pose="think" size={120} />
                  <h3 className="mt-3 text-lg font-semibold">
                    {c.activeEmptyTitle}
                  </h3>
                  <p className="mt-2 text-[13px] text-gri-700 max-w-[380px] mx-auto leading-relaxed">
                    {c.activeEmptyDesc}
                  </p>
                  <div className="mt-5 flex gap-2 justify-center">
                    <Button variant="primary" size="sm" href="/etiket">
                      <Icon.Roll size={14} /> {c.printEtiket}
                    </Button>
                    <Button variant="secondary" size="sm" href="/sticker">
                      <Icon.Sticker size={14} /> {c.printSticker}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeOrders.map((o) => {
                    const meta = statusMeta(o.status, c);
                    const phase = statusToPhaseIndex(o.status);
                    const needsAction = orderNeedsCustomerAction(o.status);
                    const phaseDone = orderCustomerPhaseDone(o.status);
                    const title =
                      o.items.length === 1
                        ? o.items[0].title
                        : c.multiOrder(o.items.length);
                    const totalQty = o.items.reduce((s, i) => s + i.qty, 0);
                    const matSummary =
                      o.items.length === 1
                        ? o.items[0].config.split("·").slice(-2).join("·").trim()
                        : c.mixed;
                    return (
                      <Card
                        key={o.id}
                        padding="p-5"
                        className={cn(
                          "relative overflow-hidden",
                          phaseDone && "opacity-70"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
                            phaseDone
                              ? "bg-yesil"
                              : needsAction
                                ? "bg-pim-mercan"
                                : "bg-gri-200"
                          )}
                          aria-hidden
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start pl-2">
                          <div className="shrink-0 rounded-xl overflow-hidden bg-gri-100 ring-1 ring-gri-200/80 p-1">
                            <PanelimPrimaryPreview
                              orderId={o.id}
                              item={o.items[0]}
                              designFiles={designFilesMap[o.id]?.[o.items[0].id]}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 font-mono">
                                {o.id}
                              </span>
                              <span
                                className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[12px] font-semibold"
                                style={{
                                  background: meta.soft,
                                  color: meta.color,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: meta.color }}
                                />
                                {meta.label}
                              </span>
                              {o.status === "in_production" && (
                                <span
                                  className="inline-flex items-center h-[22px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold"
                                  title="Tasarımın baskı atölyemize iletildi · 30 gün sonra imha"
                                >
                                  🏭 Atölyemize iletildi
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-base mb-0.5 truncate">
                              {title}
                            </div>
                            <div className="text-[13px] text-gri-700 tabular-nums">
                              {fmt(totalQty)} {c.pcs} · {matSummary} ·{" "}
                              <strong className="text-lacivert">
                                {fmt(o.total)} ₺
                              </strong>
                            </div>

                            {/* Phase mini timeline */}
                            <div className="flex items-center gap-1 mt-3.5">
                              {c.phases.map((_, i) => (
                                <div
                                  key={i}
                                  className="flex-1 flex items-center gap-1"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                      background:
                                        phase >= 0 && i < phase
                                          ? "var(--color-yesil)"
                                          : phase >= 0 && i === phase
                                            ? meta.color
                                            : "var(--color-gri-200)",
                                      boxShadow:
                                        phase >= 0 && i === phase
                                          ? `0 0 0 3px ${meta.soft}`
                                          : "none",
                                    }}
                                  />
                                  {i < c.phases.length - 1 && (
                                    <span
                                      className="flex-1 h-0.5"
                                      style={{
                                        background:
                                          phase >= 0 && i < phase
                                            ? "var(--color-yesil)"
                                            : "var(--color-gri-200)",
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[11.5px] text-gri-700 font-semibold uppercase tracking-[0.04em]">
                                {phase >= 0 ? c.phases[phase] : "—"}
                              </span>
                              <span className="text-[11.5px] text-gri-500 font-semibold uppercase tracking-[0.04em]">
                                {c.phases[c.phases.length - 1]}
                              </span>
                            </div>
                            {o.items.length === 1 && (
                              <PanelimAdditionalDesignsRow
                                item={o.items[0]}
                                designFiles={
                                  designFilesMap[o.id]?.[o.items[0].id]
                                }
                              />
                            )}
                          </div>
                          <div className="shrink-0 w-full sm:w-auto flex flex-col gap-2 min-w-[140px]">
                            <Button
                              variant="secondary"
                              size="sm"
                              href={`/siparis/${o.id}`}
                              className="w-full sm:w-auto"
                            >
                              {c.detail} <Icon.ChevR size={12} />
                            </Button>
                            <OrderActionCta
                              order={o}
                              locale={locale}
                              reordering={reordering}
                              onReorder={(ord) => void handleQuickReorder(ord)}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {hasMoreOrders && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setOrderPage((p) => p + 1)}
                      className="w-full mt-3"
                    >
                      {locale === "en"
                        ? `Show more (${allActiveOrders.length - activeOrders.length} remaining)`
                        : `Daha fazla göster (${allActiveOrders.length - activeOrders.length} kaldı)`}
                    </Button>
                  )}
                </div>
              )}
            </section>

            {/* Son teslim edilenler — yorum + tekrar sipariş */}
            {hydrated &&
              (() => {
                const recentDelivered = orders
                  .filter((o) => o.status === "delivered")
                  .slice(0, 2);
                if (recentDelivered.length === 0) return null;
                return (
                  <section>
                    <h2 className="text-[18px] font-semibold tracking-tight mb-3">
                      {locale === "en"
                        ? "Recently delivered"
                        : "Son teslim edilenler"}
                    </h2>
                    <div className="space-y-2">
                      {recentDelivered.map((o) => {
                        const dTitle =
                          o.items.length === 1
                            ? o.items[0].title
                            : locale === "en"
                              ? `${o.items.length} products`
                              : `${o.items.length} ürün`;
                        return (
                          <Card
                            key={o.id}
                            padding="p-4"
                            className="!bg-yesil-soft/20"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="shrink-0 rounded-lg overflow-hidden bg-gri-100 ring-1 ring-gri-200/80 p-0.5">
                                  <PanelimPrimaryPreview
                                    orderId={o.id}
                                    item={o.items[0]}
                                    designFiles={
                                      designFilesMap[o.id]?.[o.items[0].id]
                                    }
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-[14px] truncate">
                                    {dTitle}
                                  </div>
                                  <div className="text-[12px] text-gri-700">
                                    {fmt(o.total)} ₺ ·{" "}
                                    {locale === "en"
                                      ? "Delivered ✓"
                                      : "Teslim edildi ✓"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  href={`/yorum-yaz/${o.id}`}
                                >
                                  ⭐{" "}
                                  {locale === "en" ? "Review" : "Yorum yaz"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleQuickReorder(o)}
                                  disabled={reordering}
                                  aria-label={
                                    locale === "en" ? "Reorder" : "Tekrarla"
                                  }
                                >
                                  🔄
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

            {/* Sefa 20 May v68 (test geri bildirim): "SANA ÖZEL — Son etiket
                siparişin X adet'ti..." upsell kartı kaldırıldı (gereksiz). */}
          </div>

          {/* SIDE */}
          <div className="flex flex-col gap-4">
            <NotificationsMini />

            {/* Sadakat kuponları — aktif kupon varsa göster */}
            {loyalty && loyalty.availableCoupons.length > 0 && (
              <Card padding="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid place-items-center w-8 h-8 rounded-xl bg-yesil-soft text-yesil shrink-0">
                    <Icon.Sparkle size={16} />
                  </span>
                  <h3 className="font-semibold text-[15px]">
                    Aktif kuponların ({loyalty.availableCoupons.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {loyalty.availableCoupons.slice(0, 4).map((c2) => {
                    const valueText =
                      c2.kind === "percent"
                        ? `%${c2.value}`
                        : c2.kind === "fixed"
                          ? `${c2.value} ₺`
                          : "Ücretsiz kargo";
                    return (
                      <div
                        key={c2.id}
                        className="rounded-lg ring-1 ring-yesil/30 bg-yesil-soft px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-[12.5px] font-bold text-yesil">
                            {c2.code}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof navigator !== "undefined") {
                                void navigator.clipboard.writeText(c2.code);
                                toast.success("Kupon kodu kopyalandı");
                              }
                            }}
                            className="text-[11px] text-yesil font-semibold hover:underline"
                          >
                            kopyala
                          </button>
                        </div>
                        <div className="text-[11.5px] text-gri-700 mt-0.5 leading-snug">
                          <strong>{valueText} indirim</strong>
                          {c2.min_subtotal && c2.min_subtotal > 0
                            ? ` · min ${c2.min_subtotal} ₺`
                            : ""}
                        </div>
                        {c2.description && (
                          <div className="text-[10.5px] text-gri-500 mt-0.5 leading-snug">
                            {c2.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Referans kodu */}
            {loyalty?.referralCode && (
              <Card padding="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="grid place-items-center w-8 h-8 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0">
                    <Icon.User size={16} />
                  </span>
                  <h3 className="font-semibold text-[15px]">
                    Arkadaşını davet et
                  </h3>
                </div>
                <p className="text-[12px] text-gri-700 leading-relaxed mb-3">
                  Senin kodunla üye olan arkadaşın{" "}
                  <strong className="text-pim-mercan">kayıt anında %10 indirim</strong>{" "}
                  kuponu alır (sipariş vermesi gerekmez). Arkadaşın ilk siparişini
                  verince sen de %10 kupon kazanırsın.
                </p>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-gri-50 ring-1 ring-gri-200 font-mono text-[13px] font-bold text-lacivert truncate">
                    {loyalty.referralCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/auth?mode=signup&ref=${loyalty.referralCode}`
                        );
                        toast.success("Davet linki kopyalandı");
                      }
                    }}
                    className="px-3 rounded-lg bg-pim-mercan text-white text-[12.5px] font-semibold hover:bg-pim-mercan/90"
                  >
                    Linki kopyala
                  </button>
                </div>
                {loyalty.invited.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gri-100 text-[11.5px] text-gri-700">
                    {loyalty.invited.filter((i) => i.status === "completed").length}{" "}
                    arkadaş ilk siparişini verdi ·{" "}
                    {loyalty.invited.filter((i) => i.status === "pending").length}{" "}
                    bekliyor
                  </div>
                )}
              </Card>
            )}

            {/* Profile shortcuts */}
            <Card padding="p-2">
              {PROFILE_LINKS.map((s, i, a) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-gri-50 transition-colors",
                    i < a.length - 1 && "border-b border-gri-100"
                  )}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{s.t}</div>
                    <div className="text-[11.5px] text-gri-700 mt-0.5">
                      {s.d}
                    </div>
                  </div>
                  <Icon.ChevR size={14} className="text-gri-500" />
                </Link>
              ))}
            </Card>

            {/* Pim chat */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center mb-2.5">
                <PimMini pose="chat" size={40} />
                <div>
                  <div className="font-bold">{c.pimChatTitle}</div>
                  <div className="text-[11.5px] text-gri-700">
                    {c.pimChatSub}
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-gri-700 leading-relaxed">
                {c.pimChatDesc}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Stat({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl p-4 bg-white/70 backdrop-blur ring-1 ring-white/60">
      <div className="flex justify-between items-center">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
          {label}
        </div>
        <div className={accent}>{icon}</div>
      </div>
      <div className="text-[28px] font-bold tracking-tight mt-1.5 leading-none tabular-nums">
        {value}
      </div>
      <div className="text-[11.5px] text-gri-700 mt-1.5">{sub}</div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  href,
  primary,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href?: string;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = cn(
    "rounded-lg p-4 flex items-center gap-3.5 ring-1 transition-transform hover:-translate-y-0.5 shadow-1 text-left w-full",
    primary
      ? "bg-lacivert text-white ring-lacivert"
      : "bg-white text-lacivert ring-gri-200",
    disabled && "opacity-60 cursor-wait"
  );

  const content = (
    <>
      <div
        className={cn(
          "grid place-items-center w-11 h-11 rounded-xl shrink-0",
          primary
            ? "bg-pim-mercan text-white"
            : "bg-pim-mercan-tint text-pim-mercan"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px]">{title}</div>
        <div className="text-[13px] opacity-70 mt-0.5">{desc}</div>
      </div>
      <Icon.ArrowR size={16} />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} className={className}>
      {content}
    </Link>
  );
}
