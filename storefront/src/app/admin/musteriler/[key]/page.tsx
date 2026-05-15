/**
 * /admin/musteriler/[key] — Müşteri 360 sayfası.
 *
 * key = encodeURIComponent(`${name.toLowerCase()}|${phone}`)
 * (admin/musteriler list page'inden gelir).
 *
 * Tek bir müşterinin tüm hikâyesi:
 *   - Kişisel + fatura bilgileri
 *   - LTV + AOV + ilk sipariş + son sipariş
 *   - Segment (Yeni / Tekrar / VIP / Risk)
 *   - Sipariş timeline (kronolojik, tüm status'ler)
 *   - Ürün tercihleri (etiket vs sticker, en sevdiği malzeme)
 *   - Hızlı aksiyonlar (WhatsApp, telefon, manuel sipariş)
 *
 * Veri kuralı: customer-orders'tan map.get(key) ile bulunur. Eşleşme yoksa
 * "Müşteri bulunamadı" empty state.
 */

"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  refreshCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

interface Params {
  key: string;
}

const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; bg: string }
> = {
  paid: {
    label: "Yeni",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  qc_pending: {
    label: "AI kontrol",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  qc_flagged: { label: "AI flag", color: "text-sari-koyu", bg: "bg-sari-soft" },
  operator_review: {
    label: "Operatör",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  proof_pending: {
    label: "Prova bekliyor",
    color: "text-lacivert",
    bg: "bg-gri-100",
  },
  in_production: {
    label: "Üretimde",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
  shipped: { label: "Kargoda", color: "text-lacivert", bg: "bg-gri-100" },
  delivered: { label: "Teslim", color: "text-yesil", bg: "bg-yesil-soft" },
  cancelled: { label: "İptal", color: "text-kirmizi", bg: "bg-gri-100" },
};

interface Segment {
  key: "yeni" | "tekrar" | "vip" | "risk" | "kayıp";
  label: string;
  color: string;
  bg: string;
  reason: string;
}

const DAY = 24 * 60 * 60 * 1000;

function deriveSegment(orders: CustomerOrder[]): Segment {
  if (orders.length === 0) {
    return {
      key: "yeni",
      label: "Yeni",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
      reason: "Henüz sipariş yok",
    };
  }
  const lastOrderAt = Math.max(...orders.map((o) => o.createdAt));
  const sinceDays = Math.floor((Date.now() - lastOrderAt) / DAY);
  const count = orders.length;

  if (sinceDays > 180) {
    return {
      key: "kayıp",
      label: "Kayıp",
      color: "text-kirmizi",
      bg: "bg-gri-100",
      reason: `${sinceDays} gündür sipariş yok — geri kazanma kampanyası`,
    };
  }
  if (sinceDays > 90) {
    return {
      key: "risk",
      label: "Risk",
      color: "text-sari-koyu",
      bg: "bg-sari-soft",
      reason: `${sinceDays} gündür sipariş yok — hatırlatma maili at`,
    };
  }
  if (count >= 4) {
    return {
      key: "vip",
      label: "VIP",
      color: "text-sari-koyu",
      bg: "bg-sari-soft",
      reason: `${count} sipariş — sadık müşteri, özel ilgi`,
    };
  }
  if (count >= 2) {
    return {
      key: "tekrar",
      label: "Tekrar",
      color: "text-yesil",
      bg: "bg-yesil-soft",
      reason: `${count} sipariş — döngüye girmiş`,
    };
  }
  return {
    key: "yeni",
    label: "Yeni",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
    reason: "İlk siparişini henüz verdi — ikinciyi yakala",
  };
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR") + " TL";

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(timestamp).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Telefonu WhatsApp linkine çevir: +90, boşluk, parantez temizle */
function waLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  // TR numarası: 5XXXXXXXXX → 90 prefix
  const trimmed = digits.startsWith("90")
    ? digits
    : digits.startsWith("0")
      ? `9${digits}`
      : `90${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${trimmed}${text}`;
}

function telLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("90")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+9${digits}`
      : `+90${digits}`;
  return `tel:${e164}`;
}

interface ProductPreferences {
  etiketCount: number;
  stickerCount: number;
  topMaterial: string | null;
  topMaterialCount: number;
  avgQty: number;
}

function analyzePreferences(orders: CustomerOrder[]): ProductPreferences {
  let etiketCount = 0;
  let stickerCount = 0;
  const materialMap = new Map<string, number>();
  let totalQty = 0;
  let itemCount = 0;

  for (const o of orders) {
    for (const i of o.items) {
      if (i.product === "sticker") stickerCount++;
      else etiketCount++;
      const mat = i.material || i.materialId;
      if (mat) {
        materialMap.set(mat, (materialMap.get(mat) ?? 0) + 1);
      }
      totalQty += i.qty;
      itemCount++;
    }
  }

  let topMaterial: string | null = null;
  let topMaterialCount = 0;
  for (const [m, c] of materialMap) {
    if (c > topMaterialCount) {
      topMaterial = m;
      topMaterialCount = c;
    }
  }

  return {
    etiketCount,
    stickerCount,
    topMaterial,
    topMaterialCount,
    avgQty: itemCount > 0 ? Math.round(totalQty / itemCount) : 0,
  };
}

export default function MusteriDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { key: rawKey } = use(params);
  const decodedKey = useMemo(() => {
    try {
      return decodeURIComponent(rawKey);
    } catch {
      return rawKey;
    }
  }, [rawKey]);

  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // Pure-render kuralı (react-hooks/purity): Date.now() effect içinde — render
  // sırasında dokunulmaz. customerAge gibi türetilenler bu state üzerinden.
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    setNowMs(Date.now());
    const refresh = () => {
      setAllOrders(listCustomerOrders());
      setLoading(false);
    };
    refresh();
    refreshCustomerOrders()
      .then((orders) => {
        setAllOrders(orders);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  // Bu müşterinin siparişleri — key match
  const customerOrders = useMemo(() => {
    return allOrders
      .filter((o) => {
        const orderKey = `${o.address.name.trim().toLowerCase()}|${o.address.phone}`;
        return orderKey === decodedKey;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allOrders, decodedKey]);

  // Boş state
  if (loading) {
    return (
      <main className="py-8 pb-20">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="animate-pulse">
            <div className="h-6 bg-gri-100 rounded w-32 mb-3" />
            <div className="h-10 bg-gri-100 rounded w-72 mb-6" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gri-100 rounded-xl" />
              ))}
            </div>
            <div className="h-48 bg-gri-100 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (customerOrders.length === 0) {
    return (
      <main className="py-8 pb-20">
        <div className="mx-auto max-w-[640px] px-6">
          <Link
            href="/admin/musteriler"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-gri-700 hover:text-pim-mercan mb-6"
          >
            ← Tüm müşteriler
          </Link>
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              Müşteri bulunamadı
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              Aranan anahtar:{" "}
              <span className="font-mono text-pim-mercan">{decodedKey}</span>
              <br />
              Link bozuk olabilir veya müşteri silindi.
            </p>
            <div className="mt-5">
              <Link href="/admin/musteriler">
                <Button variant="primary" size="md">
                  Müşteri listesine dön
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  const first = customerOrders[customerOrders.length - 1];
  const last = customerOrders[0];
  const totalRevenue = customerOrders.reduce((s, o) => s + o.total, 0);
  const aov = totalRevenue / customerOrders.length;
  // nowMs effect'te hidratlanır; ilk paint'te 0 → "Bugün ilk sipariş" gösterir
  const customerAge = nowMs
    ? Math.floor((nowMs - first.createdAt) / DAY)
    : 0;

  // Aktif (delivered/cancelled hariç) siparişler
  const active = customerOrders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  );
  const cancelled = customerOrders.filter((o) => o.status === "cancelled");

  const segment = deriveSegment(customerOrders);
  const prefs = analyzePreferences(customerOrders);

  // Latest address + invoice
  const latestAddress = last.address;
  const latestInvoice = last.invoice;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Breadcrumb */}
        <Link
          href="/admin/musteriler"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-gri-700 hover:text-pim-mercan mb-4"
        >
          ← Tüm müşteriler
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <Eyebrow>Müşteri 360</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight flex items-center gap-3 flex-wrap">
              {latestAddress.name}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full text-[11.5px] font-bold uppercase tracking-[0.04em]",
                  segment.bg,
                  segment.color
                )}
              >
                {segment.key === "vip" && <Icon.Star size={11} />}
                {segment.label}
              </span>
            </h1>
            <p className="mt-1.5 text-base text-gri-700 flex items-center gap-3 flex-wrap">
              <span>{latestAddress.phone}</span>
              <span className="text-gri-300">·</span>
              <span>{latestAddress.city}</span>
              <span className="text-gri-300">·</span>
              <span>
                {customerAge === 0
                  ? "Bugün ilk sipariş"
                  : `${customerAge} gündür müşteri`}
              </span>
            </p>
            <p className="mt-2 text-[13px] text-gri-500 italic">
              {segment.reason}
            </p>
          </div>

          {/* Hızlı aksiyonlar */}
          <div className="flex gap-2 flex-wrap">
            <a
              href={waLink(
                latestAddress.phone,
                `Merhaba ${latestAddress.name}, Pim Etiket'ten yazıyorum.`
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="md">
                <Icon.ChatBubble size={14} /> WhatsApp
              </Button>
            </a>
            <a href={telLink(latestAddress.phone)}>
              <Button variant="ghost" size="md">
                Ara
              </Button>
            </a>
            <Link href="/admin/siparis-ekle">
              <Button variant="primary" size="md">
                <Icon.Plus size={14} /> Manuel sipariş
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI grid 4 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Yaşam boyu değer
            </div>
            <div className="text-[26px] font-bold mt-1 leading-none tabular-nums text-yesil">
              {fmt(totalRevenue)}
            </div>
            <div className="text-[11px] mt-1.5 text-gri-700">
              {customerOrders.length} sipariş bazlı
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Sepet ortalaması
            </div>
            <div className="text-[26px] font-bold mt-1 leading-none tabular-nums text-lacivert">
              {fmt(aov)}
            </div>
            <div className="text-[11px] mt-1.5 text-gri-700">
              Sipariş başına ortalama
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Sipariş sayısı
            </div>
            <div className="text-[26px] font-bold mt-1 leading-none tabular-nums text-pim-mercan">
              {customerOrders.length}
            </div>
            <div className="text-[11px] mt-1.5 text-gri-700">
              {active.length > 0
                ? `${active.length} aktif iş`
                : "Aktif iş yok"}
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Son sipariş
            </div>
            <div className="text-[18px] font-bold mt-1 leading-tight text-lacivert">
              {timeAgo(last.createdAt)}
            </div>
            <div className="text-[11px] mt-1.5 text-gri-700">
              İlk: {timeAgo(first.createdAt)}
            </div>
          </Card>
        </div>

        {/* 2-column grid: timeline + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
          {/* Sol kolon: sipariş timeline */}
          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">
                Sipariş geçmişi · {customerOrders.length}
              </h2>
              {cancelled.length > 0 && (
                <span className="text-[12px] text-kirmizi font-semibold">
                  {cancelled.length} iptal
                </span>
              )}
            </div>
            <div className="divide-y divide-gri-100">
              {customerOrders.map((o) => {
                const meta = STATUS_META[o.status];
                const itemSummary =
                  o.items.length === 1
                    ? `${o.items[0].product === "sticker" ? "Sticker" : "Etiket"} · ${o.items[0].config}`
                    : `${o.items.length} ürün`;
                const totalQty = o.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <Link
                    key={o.id}
                    href={`/admin/siparisler/${o.id}`}
                    className="block px-5 py-4 hover:bg-gri-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center h-[22px] px-2 rounded-full text-[10.5px] font-bold shrink-0",
                              meta.bg,
                              meta.color
                            )}
                          >
                            {meta.label}
                          </span>
                          <span className="font-mono text-[13px] font-semibold text-pim-mercan">
                            {o.id}
                          </span>
                          <span className="text-[11.5px] text-gri-500">
                            · {formatFullDate(o.createdAt)}
                          </span>
                        </div>
                        <div className="text-[13.5px] font-medium text-lacivert truncate">
                          {itemSummary}
                        </div>
                        <div className="text-[12px] text-gri-700 mt-0.5">
                          {totalQty.toLocaleString("tr-TR")} adet · Tahmini
                          teslim:{" "}
                          {o.estimatedDelivery
                            ? new Date(o.estimatedDelivery).toLocaleDateString(
                                "tr-TR",
                                {
                                  day: "numeric",
                                  month: "short",
                                }
                              )
                            : "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[15px] font-bold tabular-nums text-yesil">
                          {fmt(o.total)}
                        </div>
                        <div className="text-[11px] text-gri-500 mt-0.5">
                          {o.payment.method === "card"
                            ? `Kart${o.payment.masked ? ` · ${o.payment.masked}` : ""}`
                            : "Havale"}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Sağ kolon: bilgi panelleri (lg+ sticky — uzun timeline'ı kolay tara) */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* İletişim & Adres */}
            <Card padding="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon.User size={14} className="text-pim-mercan" />
                <h3 className="text-[14px] font-semibold">İletişim & Adres</h3>
              </div>
              <dl className="space-y-2 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                    Ad Soyad
                  </dt>
                  <dd className="text-lacivert font-medium">
                    {latestAddress.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                    Telefon
                  </dt>
                  <dd className="text-lacivert font-medium font-mono">
                    {latestAddress.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                    Şehir
                  </dt>
                  <dd className="text-lacivert font-medium">
                    {latestAddress.city}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                    Son adres
                  </dt>
                  <dd className="text-gri-700 leading-relaxed">
                    {latestAddress.addr}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Fatura bilgisi */}
            <Card padding="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon.Doc size={14} className="text-pim-mercan" />
                <h3 className="text-[14px] font-semibold">Fatura bilgisi</h3>
              </div>
              {latestInvoice.type === "corporate" ? (
                <dl className="space-y-2 text-[13px]">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                      Tür
                    </dt>
                    <dd>
                      <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-bold">
                        Kurumsal
                      </span>
                    </dd>
                  </div>
                  {latestInvoice.companyName && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                        Ünvan
                      </dt>
                      <dd className="text-lacivert font-medium">
                        {latestInvoice.companyName}
                      </dd>
                    </div>
                  )}
                  {latestInvoice.vkn && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                        VKN
                      </dt>
                      <dd className="text-lacivert font-mono">
                        {latestInvoice.vkn}
                      </dd>
                    </div>
                  )}
                  {latestInvoice.taxOffice && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                        Vergi Dairesi
                      </dt>
                      <dd className="text-gri-700">
                        {latestInvoice.taxOffice}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <dl className="space-y-2 text-[13px]">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                      Tür
                    </dt>
                    <dd>
                      <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[10.5px] font-bold">
                        Bireysel
                      </span>
                    </dd>
                  </div>
                  {latestInvoice.tc && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
                        TC
                      </dt>
                      <dd className="text-lacivert font-mono">
                        {latestInvoice.tc}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </Card>

            {/* Ürün tercihleri */}
            <Card padding="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon.Sparkle size={14} className="text-pim-mercan" />
                <h3 className="text-[14px] font-semibold">Ürün tercihleri</h3>
              </div>
              {prefs.etiketCount + prefs.stickerCount === 0 ? (
                <p className="text-[12.5px] text-gri-500 italic">
                  Henüz ürün verisi yok.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Etiket vs sticker bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11.5px] text-gri-700 mb-1.5">
                      <span>
                        Etiket{" "}
                        <span className="font-bold text-lacivert">
                          {prefs.etiketCount}
                        </span>
                      </span>
                      <span>
                        <span className="font-bold text-lacivert">
                          {prefs.stickerCount}
                        </span>{" "}
                        Sticker
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gri-100 overflow-hidden flex">
                      {prefs.etiketCount > 0 && (
                        <div
                          className="bg-pim-mercan h-full"
                          style={{
                            width: `${(prefs.etiketCount / (prefs.etiketCount + prefs.stickerCount)) * 100}%`,
                          }}
                        />
                      )}
                      {prefs.stickerCount > 0 && (
                        <div
                          className="bg-lacivert h-full"
                          style={{
                            width: `${(prefs.stickerCount / (prefs.etiketCount + prefs.stickerCount)) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {prefs.topMaterial && (
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-gri-700">En sevdiği malzeme</span>
                      <span className="font-semibold text-lacivert capitalize">
                        {prefs.topMaterial} ({prefs.topMaterialCount})
                      </span>
                    </div>
                  )}

                  {prefs.avgQty > 0 && (
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-gri-700">Ortalama adet</span>
                      <span className="font-semibold text-lacivert tabular-nums">
                        {prefs.avgQty.toLocaleString("tr-TR")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* İletişim notları — placeholder (gelecek özelliği) */}
            <Card padding="p-5" className="bg-gri-50">
              <div className="flex items-center gap-2 mb-2">
                <Icon.ChatBubble size={14} className="text-gri-500" />
                <h3 className="text-[14px] font-semibold text-gri-700">
                  İletişim notları
                </h3>
              </div>
              <p className="text-[12px] text-gri-500 italic leading-relaxed">
                Operatör notları yakında — bu müşteriye özel WhatsApp/telefon
                geçmişi, prova yorumları, kişisel istekler burada
                birikecek.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
