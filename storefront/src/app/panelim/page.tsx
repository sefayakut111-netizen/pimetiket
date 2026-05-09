/**
 * Pim Etiket — /panelim (E.2.2)
 *
 * Customer dashboard. customer-orders store'undan canlı veri okur:
 *   - Aktif siparişler (delivered/cancelled hariç) ilk 3
 *   - "Bu yıl basıldı" toplamı qty üzerinden
 *   - Quick re-order: en son etiket/sticker siparişi
 *
 * Cüzdan + tasarım kütüphanesi şu an placeholder (auth + storage backend
 * swap'tan sonra aktif).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

const PHASES = [
  "Konfigüre",
  "Ödendi",
  "Yüklendi",
  "AI kontrol",
  "Onay",
  "Üretim",
  "Kargo",
  "Teslim",
];

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

function statusMeta(status: OrderStatus): {
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
        label: "Kontrolde",
        color: "var(--color-sari)",
        soft: "var(--color-sari-soft)",
        pim: "inspect",
      };
    case "proof_pending":
      return {
        label: "Onay bekliyor",
        color: "var(--color-sari)",
        soft: "var(--color-sari-soft)",
        pim: "inspect",
      };
    case "in_production":
      return {
        label: "Üretimde",
        color: "var(--color-pim-mercan)",
        soft: "var(--color-pim-mercan-tint)",
        pim: "happy",
      };
    case "shipped":
      return {
        label: "Kargoda",
        color: "var(--color-lacivert)",
        soft: "var(--color-gri-100)",
        pim: "box",
      };
    case "delivered":
      return {
        label: "Teslim edildi",
        color: "var(--color-yesil)",
        soft: "var(--color-yesil-soft)",
        pim: "wave",
      };
    case "cancelled":
      return {
        label: "İptal",
        color: "var(--color-kirmizi)",
        soft: "var(--color-gri-100)",
        pim: "inspect",
      };
  }
}

const PROFILE_LINKS = [
  { t: "Profil ayarları", d: "Ad, e-posta, şifre", href: "/profil" },
  { t: "Adres defterim", d: "Teslim ve fatura adresleri", href: "/adreslerim" },
  { t: "Fatura bilgileri", d: "TC/VKN, e-fatura tercihi", href: "/fatura-bilgileri" },
  { t: "Yardım merkezi", d: "Pim ile sohbet", href: "/sss" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function PanelimPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setOrders(listCustomerOrders());
    refresh();
    setHydrated(true);
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

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

  const today = new Date();
  const dateLabel = today
    .toLocaleDateString("tr-TR", {
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
          <h1 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight mt-2 mb-1.5">
            {customerName ? `Hoş geldin, ${customerName} 👋` : "Hoş geldin 👋"}
          </h1>
          <p className="text-base text-gri-700">
            {!hydrated
              ? "..."
              : activeCount === 0
                ? "Henüz aktif siparişin yok. Pim seninle bir tur atmak için sabırsızlanıyor."
                : `${activeCount} aktif siparişin var. ${inProductionCount > 0 ? `${inProductionCount} tanesi üretimde.` : ""} ${shippedCount > 0 ? `${shippedCount} tanesi kargoda.` : ""}`.trim()}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7 max-w-[720px]">
            <Stat
              label="Aktif sipariş"
              value={hydrated ? activeCount.toString() : "—"}
              sub={
                inProductionCount + shippedCount > 0
                  ? `${inProductionCount} üretimde, ${shippedCount} kargoda`
                  : "Yeni sipariş için hazır"
              }
              icon={<Icon.Box size={18} />}
              accent="text-pim-mercan"
            />
            <Stat
              label="Cüzdan bakiyen"
              value="0 TL"
              sub="Cüzdan açılışı yakında"
              icon={<Icon.Wallet size={18} />}
              accent="text-yesil"
            />
            <Stat
              label={`${thisYear} basıldı`}
              value={hydrated ? fmt(thisYearTotalQty) : "—"}
              sub="adet etiket + sticker"
              icon={<Icon.Sparkle size={18} />}
              accent="text-turuncu"
            />
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <QuickAction
            icon={<Icon.Roll size={20} />}
            title="Yeni etiket"
            desc="1000 adetten başla"
            href="/etiket"
            primary
          />
          <QuickAction
            icon={<Icon.Sticker size={20} />}
            title="Yeni sticker"
            desc="25 adetten başla"
            href="/sticker"
          />
          <QuickAction
            icon={<Icon.Bolt size={20} />}
            title="Tekrar sipariş"
            desc={
              lastEtiketItem
                ? `Son etiket: ${lastEtiketItem.title.split("·").slice(1).join("·").trim() || "Tekrarla"}`
                : lastStickerItem
                  ? `Son sticker: ${lastStickerItem.title.split("·").slice(1).join("·").trim() || "Tekrarla"}`
                  : "Yakında öneri"
            }
            href={lastEtiketItem ? "/etiket" : "/sticker"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Active orders */}
            <section>
              <div className="flex justify-between items-center mb-3.5">
                <h2 className="text-[24px] font-semibold tracking-tight">
                  Aktif siparişler
                </h2>
                <Link
                  href="/siparislerim"
                  className="text-[13px] font-semibold text-gri-700 hover:text-pim-mercan inline-flex items-center gap-1"
                >
                  Tümünü gör <Icon.ChevR size={12} />
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
                    Aktif sipariş yok
                  </h3>
                  <p className="mt-2 text-[13px] text-gri-700 max-w-[380px] mx-auto leading-relaxed">
                    Yeni bir etiket veya sticker konfigüre etmeye başla —
                    sipariş verdiğinde burada görünecek.
                  </p>
                  <div className="mt-5 flex gap-2 justify-center">
                    <Button variant="primary" size="sm" href="/etiket">
                      <Icon.Roll size={14} /> Etiket bastır
                    </Button>
                    <Button variant="secondary" size="sm" href="/sticker">
                      <Icon.Sticker size={14} /> Sticker bastır
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeOrders.map((o) => {
                    const meta = statusMeta(o.status);
                    const phase = statusToPhaseIndex(o.status);
                    const title =
                      o.items.length === 1
                        ? o.items[0].title
                        : `${o.items.length} ürünlük sipariş`;
                    const totalQty = o.items.reduce((s, i) => s + i.qty, 0);
                    const matSummary =
                      o.items.length === 1
                        ? o.items[0].config.split("·").slice(-2).join("·").trim()
                        : "Karışık";
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
                              {fmt(totalQty)} adet · {matSummary}
                            </div>

                            {/* Phase mini timeline */}
                            <div className="flex items-center gap-1 mt-3.5">
                              {PHASES.map((_, i) => (
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
                                  {i < PHASES.length - 1 && (
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
                                {PHASES[phase]}
                              </span>
                              <span
                                className="text-[11.5px] font-bold uppercase tracking-[0.04em]"
                                style={{ color: meta.color }}
                              >
                                Detay →
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            href={`/siparis/${o.id}`}
                            className="shrink-0"
                          >
                            Detay <Icon.ChevR size={12} />
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
                    SANA ÖZEL
                  </div>
                  <div className="font-semibold text-[15px] mt-1 leading-snug">
                    Son etiket siparişin{" "}
                    <strong>
                      {lastEtiketQty.toLocaleString("tr-TR")} adet
                    </strong>
                    &rsquo;ti — stokun azalmış olabilir, yeniden bastıralım mı?
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  href="/etiket"
                  className="!bg-white !text-lacivert !ring-0 shrink-0"
                >
                  Yeniden bastır <Icon.ArrowR size={14} />
                </Button>
              </div>
            )}
          </div>

          {/* SIDE */}
          <div className="flex flex-col gap-4">
            {/* Wallet */}
            <Card padding="p-5">
              <div className="flex justify-between items-center mb-3.5">
                <h3 className="text-base font-semibold m-0">Cüzdan</h3>
                <Icon.Wallet size={18} />
              </div>
              <div className="text-[28px] font-bold tracking-tight tabular-nums">
                0{" "}
                <span className="text-base font-semibold text-gri-700">
                  TL
                </span>
              </div>
              <div className="text-[13px] text-gri-700 mt-1">
                Cüzdandan ödeyince{" "}
                <strong className="text-yesil">+%2 indirim</strong> kazanırsın
              </div>
              <div className="flex gap-2 mt-3.5">
                <Button
                  variant="primary"
                  size="sm"
                  href="/cuzdan"
                  className="flex-1"
                >
                  <Icon.Plus size={14} /> Yatır
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  href="/cuzdan"
                  className="flex-1"
                >
                  Detay
                </Button>
              </div>
              <div className="text-[11.5px] text-gri-500 mt-3 leading-relaxed">
                Cüzdan akışı yakında — sadakat puanı ve özel ödemeler için.
              </div>
            </Card>

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
                  <div className="font-bold">Pim&rsquo;le konuş</div>
                  <div className="text-[11.5px] text-gri-700">
                    Sağ alttaki balonla sohbet aç
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-gri-700 leading-relaxed">
                Soru, sipariş takibi, fiyat hesabı — Pim her zaman sayfanın
                sağ alt köşesinde. Tıkla, konuş.
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
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg p-4 flex items-center gap-3.5 ring-1 transition-transform hover:-translate-y-0.5 shadow-1",
        primary
          ? "bg-lacivert text-white ring-lacivert"
          : "bg-white text-lacivert ring-gri-200"
      )}
    >
      <div
        className={cn(
          "grid place-items-center w-11 h-11 rounded-xl shrink-0",
          primary ? "bg-pim-mercan text-white" : "bg-pim-mercan-tint text-pim-mercan"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px]">{title}</div>
        <div className="text-[13px] opacity-70 mt-0.5">{desc}</div>
      </div>
      <Icon.ArrowR size={16} />
    </Link>
  );
}
