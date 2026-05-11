/**
 * Pim Etiket — /panelim (E.2.2)
 *
 * Customer dashboard. customer-orders store'undan canlı veri okur:
 *   - Aktif siparişler (delivered/cancelled hariç) ilk 3
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
import type { OrderStatus } from "@/lib/order";
import { useT } from "@/lib/i18n/context";

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
    qaReorder: "Tekrar sipariş",
    qaReorderEtiket: (label: string) => `Son etiket: ${label}`,
    qaReorderSticker: (label: string) => `Son sticker: ${label}`,
    qaReorderSoon: "Yakında öneri",
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
    detailArrow: "Detay →",
    aiForYou: "SANA ÖZEL",
    aiUpsell: (qty: string) => (
      <>
        Son etiket siparişin <strong>{qty} adet</strong>&rsquo;ti — stokun
        azalmış olabilir, yeniden bastıralım mı?
      </>
    ),
    reprint: "Yeniden bastır",
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
    qaReorder: "Reorder",
    qaReorderEtiket: (label: string) => `Last label: ${label}`,
    qaReorderSticker: (label: string) => `Last sticker: ${label}`,
    qaReorderSoon: "Suggestions soon",
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
    detailArrow: "Details →",
    aiForYou: "JUST FOR YOU",
    aiUpsell: (qty: string) => (
      <>
        Your last label order was <strong>{qty} units</strong> — stock may be
        running low, want to reprint?
      </>
    ),
    reprint: "Reprint",
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
    case "qc_pending":
      return 3;
    case "qc_flagged":
    case "operator_review":
      return 4;
    case "proof_pending":
      return 4;
    case "in_production":
      return 5;
    case "shipped":
      return 6;
    case "delivered":
      return 7;
    default:
      return 0;
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
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    ensureAuthBindings();
    const refresh = () => setOrders(listCustomerOrders());
    void refreshCustomerOrders().then(() => {
      refresh();
      setHydrated(true);
    });
    window.addEventListener("pim_customer_orders_updated", refresh);

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
      toast.error("Bir şeyler ters gitti, tekrar dene");
    } finally {
      setReordering(false);
    }
  };

  const fmt = (n: number) => Math.round(n).toLocaleString(c.locale);

  const PROFILE_LINKS = [
    { ...c.profileSettings, href: "/profil" },
    { ...c.addressBook, href: "/adreslerim" },
    { ...c.invoiceInfo, href: "/fatura-bilgileri" },
    { ...c.helpCenter, href: "/sss" },
  ];

  // Aktif siparişler (delivered + cancelled hariç) — ilk 3
  const activeOrders = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .slice(0, 3);

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
    .filter((o) => new Date(o.createdAtIso).getFullYear() === thisYear)
    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);

  // Selam — son müşteri adı (auth gelince kullanıcı profilden)
  const customerName =
    orders.length > 0 ? orders[0].address.name.split(" ")[0] : null;

  // Tekrar sipariş için en son etiket / sticker item'ı
  const lastEtiketOrder = orders.find((o) =>
    o.items.some((i) => i.product === "etiket")
  );
  const lastEtiketItem = lastEtiketOrder?.items.find(
    (i) => i.product === "etiket"
  );
  const lastEtiketQty = lastEtiketItem?.qty ?? 0;

  const lastStickerOrder = orders.find((o) =>
    o.items.some((i) => i.product === "sticker")
  );
  const lastStickerItem = lastStickerOrder?.items.find(
    (i) => i.product === "sticker"
  );

  // Quick reorder: en son sipariş (etiket varsa o, yoksa sticker)
  const lastReorderTarget = lastEtiketOrder ?? lastStickerOrder ?? null;

  const today = new Date();
  const dateLabel = today
    .toLocaleDateString(c.locale, {
      day: "numeric",
      month: "long",
      weekday: "long",
    })
    .toUpperCase();

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-2xl p-8 mb-6 bg-gradient-to-br from-krem to-krem-soft ring-1 ring-black/[0.04]">
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
            {loyalty?.vipSince && (
              <span
                className="inline-flex items-center gap-1.5 px-3 h-[28px] rounded-full bg-gradient-to-r from-sari to-[#FFC53D] text-[#7A560A] text-[12.5px] font-bold uppercase tracking-[0.06em] shadow-1"
                title={`VIP üye — ${new Date(loyalty.vipSince).toLocaleDateString("tr-TR")} tarihinden`}
              >
                <Icon.Star size={13} /> VIP
              </span>
            )}
          </h1>
          <p className="text-base text-gri-700">
            {!hydrated
              ? "..."
              : activeCount === 0
                ? c.activeNone
                : c.activeSummary(activeCount, inProductionCount, shippedCount)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7 max-w-[520px]">
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
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <QuickAction
            icon={<Icon.Roll size={20} />}
            title={c.qaNewEtiket}
            desc={c.qaNewEtiketDesc}
            href="/etiket"
            primary
          />
          <QuickAction
            icon={<Icon.Sticker size={20} />}
            title={c.qaNewSticker}
            desc={c.qaNewStickerDesc}
            href="/sticker"
          />
          <QuickAction
            icon={<Icon.Bolt size={20} />}
            title={c.qaReorder}
            desc={
              lastEtiketItem
                ? c.qaReorderEtiket(
                    lastEtiketItem.title.split("·").slice(1).join("·").trim() ||
                      c.qaReorderRepeat
                  )
                : lastStickerItem
                  ? c.qaReorderSticker(
                      lastStickerItem.title
                        .split("·")
                        .slice(1)
                        .join("·")
                        .trim() || c.qaReorderRepeat
                    )
                  : c.qaReorderSoon
            }
            onClick={
              lastReorderTarget
                ? () => handleQuickReorder(lastReorderTarget)
                : undefined
            }
            href={lastReorderTarget ? undefined : "/etiket"}
            disabled={reordering}
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
                      <Card key={o.id} padding="p-5">
                        <div className="flex gap-4 items-start">
                          <div
                            className="grid place-items-center w-14 h-14 rounded-xl shrink-0"
                            style={{ background: meta.soft }}
                          >
                            <PimMini pose={meta.pim} size={48} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1">
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
                            </div>
                            <div className="font-semibold text-base mb-0.5 truncate">
                              {title}
                            </div>
                            <div className="text-[13px] text-gri-700 tabular-nums">
                              {fmt(totalQty)} {c.pcs} · {matSummary}
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
                                        i < phase
                                          ? "var(--color-yesil)"
                                          : i === phase
                                            ? meta.color
                                            : "var(--color-gri-200)",
                                      boxShadow:
                                        i === phase
                                          ? `0 0 0 3px ${meta.soft}`
                                          : "none",
                                    }}
                                  />
                                  {i < c.phases.length - 1 && (
                                    <span
                                      className="flex-1 h-0.5"
                                      style={{
                                        background:
                                          i < phase
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
                                {c.phases[phase]}
                              </span>
                              <span
                                className="text-[11.5px] font-bold uppercase tracking-[0.04em]"
                                style={{ color: meta.color }}
                              >
                                {c.detailArrow}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            href={`/siparis/${o.id}`}
                            className="shrink-0"
                          >
                            {c.detail} <Icon.ChevR size={12} />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* AI suggestion — son etiket varsa upsell */}
            {hydrated && lastEtiketItem && (
              <div className="rounded-lg p-5 bg-gradient-to-br from-lacivert to-[#2C3849] text-white flex gap-5 items-center">
                <PimMini pose="think" size={56} />
                <div className="flex-1">
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-white/60">
                    {c.aiForYou}
                  </div>
                  <div className="font-semibold text-[15px] mt-1 leading-snug">
                    {c.aiUpsell(lastEtiketQty.toLocaleString(c.locale))}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  href="/etiket"
                  className="!bg-white !text-lacivert !ring-0 shrink-0"
                >
                  {c.reprint} <Icon.ArrowR size={14} />
                </Button>
              </div>
            )}
          </div>

          {/* SIDE */}
          <div className="flex flex-col gap-4">
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
                          ? `${c2.value} TL`
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
                            ? ` · min ${c2.min_subtotal} TL`
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
                  Senin kodunla kayıt olan herkes ilk siparişinde{" "}
                  <strong className="text-pim-mercan">%10 indirim</strong>{" "}
                  kazanır. İlk siparişini verince sen de %10 kupon alırsın.
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
