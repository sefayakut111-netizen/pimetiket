/**
 * /admin/siparisler/[id] — Admin sipariş detay sayfası.
 *
 * Operatörün gördüğü tüm bilgi + durum güncelleme + iptal aksiyonu.
 * customer-facing /siparis/[id]'den FARKLI:
 *   - Tam müşteri bilgisi (ad/telefon/adres)
 *   - Fatura tipi + TC/VKN (sansürlenmemiş)
 *   - Tüm 9 status arasında geçiş (UI'dan değişebilir)
 *   - Operatör notları (gelecek)
 */

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Card, Button, Eyebrow, useToast, Skeleton } from "@/components/ui";
import { AdminTrackingForm } from "@/components/admin/AdminTrackingForm";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  paid: { label: "Yeni — dosya bekleniyor", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  awaiting_upload: { label: "Müşteri tasarım yüklemedi (Mig 061)", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_pending: { label: "AI kontrol", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_flagged: { label: "AI flag — manuel kontrol", color: "text-sari-koyu", bg: "bg-sari-soft" },
  operator_review: { label: "Operatör inceliyor", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  // Sefa 19 May v68 (DB↔TS sync): 5 yeni statü
  human_review: { label: "İnsan incelemesi", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  human_review_failed: { label: "Düzeltme isteniyor", color: "text-kirmizi-koyu", bg: "bg-kirmizi-soft" },
  proof_generating: { label: "Prova hazırlanıyor", color: "text-lacivert", bg: "bg-gri-100" },
  proof_pending: { label: "Müşteri baskı onayı bekleniyor", color: "text-lacivert", bg: "bg-gri-100" },
  proof_approved: { label: "Müşteri tüm baskıları onayladı", color: "text-yesil", bg: "bg-yesil-soft" },
  ready_to_ship: { label: "Üretime hazır", color: "text-mavi-koyu", bg: "bg-mavi-soft" },
  fason_assigned: { label: "Fasona atandı", color: "text-mavi-koyu", bg: "bg-mavi-soft" },
  in_production: { label: "Üretimde", color: "text-yesil", bg: "bg-yesil-soft" },
  shipped: { label: "Kargoda", color: "text-lacivert", bg: "bg-gri-100" },
  delivered: { label: "Teslim edildi", color: "text-yesil", bg: "bg-yesil-soft" },
  cancelled: { label: "İptal", color: "text-kirmizi", bg: "bg-gri-100" },
};

const ALL_STATUSES: OrderStatus[] = [
  "paid",
  "qc_pending",
  "qc_flagged",
  "operator_review",
  "proof_pending",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
];

interface Params {
  id: string;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(n: number): string {
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);

  // Fason atama state
  const [fasonSuggestions, setFasonSuggestions] = useState<
    Array<{
      fason_id: string;
      fason_name: string;
      cached_score: number | null;
      active_count: number;
      reason: string;
    }>
  >([]);
  const [selectedFasonId, setSelectedFasonId] = useState<string>("");
  const [fasonDeliveryDate, setFasonDeliveryDate] = useState<string>("");
  const [fasonNotes, setFasonNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentInfo, setAssignmentInfo] = useState<{
    assignmentId: string;
    fasonToken: string;
    fasonName: string;
  } | null>(null);

  const loadFasonSuggestions = async (specialty: "etiket" | "sticker" | null) => {
    try {
      const qs = specialty ? `?specialty=${specialty}` : "";
      const res = await fetch(`/api/admin/fason/suggest${qs}`);
      if (res.ok) {
        const json = (await res.json()) as {
          suggestions: typeof fasonSuggestions;
        };
        setFasonSuggestions(json.suggestions);
        // Otomatik en yüksek skorlu fason'u seç
        if (json.suggestions.length > 0 && !selectedFasonId) {
          setSelectedFasonId(json.suggestions[0].fason_id);
        }
      }
    } catch (e) {
      console.error("[fason/suggest]", e);
    }
  };

  const handleFasonAssign = async () => {
    if (!order || !selectedFasonId) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/fason/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          fasonPartnerId: selectedFasonId,
          estimatedDelivery: fasonDeliveryDate || null,
          notes: fasonNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Atama başarısız");
        return;
      }
      const json = (await res.json()) as {
        assignmentId: string;
        fasonToken: string;
        fasonName: string;
      };
      setAssignmentInfo(json);
      toast.success(`${json.fasonName}'a atama yapıldı`);
      setOrder({ ...order, status: "in_production" });
    } catch (e) {
      console.error("[fason/assign]", e);
      toast.error("Bağlantı hatası");
    } finally {
      setAssigning(false);
    }
  };

  const handleProofUpload = async (file: File) => {
    if (!order) return;
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/orders/${order.id}/upload-proof`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Yükleme başarısız");
        return;
      }
      toast.success(
        "Prova yüklendi — müşteri onay bekliyor (proof_pending)"
      );
      setOrder({ ...order, status: "proof_pending" });
    } catch (e) {
      console.error("[proof-upload]", e);
      toast.error("Bağlantı hatası");
    } finally {
      setProofUploading(false);
    }
  };

  useEffect(() => {
    const refresh = async () => {
      // 1) Önce yerel cache (localStorage / customer-order)
      const found = listCustomerOrders().find((o) => o.id === id);
      if (found) {
        setOrder(found);
        setLoading(false);
        return;
      }
      // 2) DB'den admin endpoint ile çek (manuel sipariş veya başka müşterinin)
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (res.ok) {
          const json = (await res.json()) as {
            order: {
              id: string;
              status: OrderStatus;
              subtotal: number;
              shipping: number;
              total: number;
              address: CustomerOrder["address"];
              invoice: CustomerOrder["invoice"];
              payment: CustomerOrder["payment"];
              estimated_delivery: string | null;
              created_at: string;
            };
            items: Array<{
              id: string;
              product: "etiket" | "sticker";
              title: string;
              config: string;
              width: number;
              height: number;
              qty: number;
              unit: number;
              total: number;
              meta: Record<string, unknown>;
            }>;
          };
          const ts = new Date(json.order.created_at).getTime();
          setOrder({
            id: json.order.id,
            status: json.order.status,
            subtotal: Number(json.order.subtotal),
            shipping: Number(json.order.shipping),
            total: Number(json.order.total),
            address: json.order.address,
            invoice: json.order.invoice,
            payment: json.order.payment,
            estimatedDelivery: json.order.estimated_delivery ?? undefined,
            createdAt: ts,
            createdAtIso: json.order.created_at,
            items: json.items.map((i) => ({
              id: i.id,
              product: i.product,
              title: i.title,
              config: i.config,
              width: Number(i.width),
              height: Number(i.height),
              qty: i.qty,
              unit: Number(i.unit),
              total: Number(i.total),
              addedAt: ts,
            })),
          });
        } else {
          setOrder(null);
        }
      } catch (e) {
        console.error("[admin/orders GET]", e);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    void refresh();
    window.addEventListener("pim_customer_orders_updated", () => void refresh());
    return () =>
      window.removeEventListener("pim_customer_orders_updated", () => void refresh());
  }, [id]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    if (newStatus === order.status) return;
    if (
      newStatus === "cancelled" &&
      !confirm("Bu sipariş iptal edilecek. Emin misin?")
    ) {
      return;
    }
    setUpdating(true);
    try {
      // Önce gerçek DB endpoint'i dene
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Durum güncellendi → ${STATUS_META[newStatus].label}`);
        // Order'ı yenile (yerel customer-order cache de senkron etmek için)
        const found = listCustomerOrders().find((o) => o.id === order.id);
        if (found) {
          setOrder({ ...found, status: newStatus });
        } else {
          setOrder({ ...order, status: newStatus });
        }
      } else {
        // DB'de bulamadıysa (localStorage-only mock order) → eski yola dön
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (j.error === "Sipariş bulunamadı") {
          updateCustomerOrderStatus(order.id, newStatus);
          toast.success(`Durum güncellendi → ${STATUS_META[newStatus].label}`);
          setOrder({ ...order, status: newStatus });
        } else {
          toast.error(j.error ?? "Güncelleme başarısız");
        }
      }
    } catch (e) {
      console.error("[status]", e);
      toast.error("Bağlantı hatası");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[960px] px-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton.KpiStrip />
          <Skeleton.Card />
          <Skeleton.Card />
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[640px] px-6 text-center">
          <Icon.Box size={48} className="mx-auto text-gri-500 mb-3" />
          <h1 className="text-[24px] font-semibold mb-2">Sipariş bulunamadı</h1>
          <p className="text-[14px] text-gri-700 mb-5">
            <span className="font-mono">{id}</span> numaralı sipariş kayıtlarda
            yok. Silinmiş veya başka bir hesaba ait olabilir.
          </p>
          <Button variant="primary" size="md" href="/admin/siparisler">
            Tüm siparişlere dön
          </Button>
        </div>
      </main>
    );
  }

  const meta = STATUS_META[order.status];
  const product =
    order.items.length === 1
      ? order.items[0].title
      : `${order.items.length} ürün`;

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[1180px] px-6">
        {/* Breadcrumb + back */}
        <div className="mb-5 flex items-center gap-2 text-[12.5px] text-gri-700">
          <Link href="/admin" className="hover:text-lacivert">
            Dashboard
          </Link>
          <Icon.ChevR size={10} />
          <Link href="/admin/siparisler" className="hover:text-lacivert">
            Siparişler
          </Link>
          <Icon.ChevR size={10} />
          <span className="font-mono text-lacivert font-semibold">
            {order.id}
          </span>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <Eyebrow>Sipariş detayı</Eyebrow>
            <h1 className="mt-2 text-[26px] md:text-[30px] font-semibold tracking-tight font-mono">
              {order.id}
            </h1>
            <p className="mt-1 text-[14px] text-gri-700">
              {order.address.name} · {product} · {formatDate(order.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center h-8 px-3 rounded-full text-[12.5px] font-bold",
                meta.bg,
                meta.color
              )}
            >
              {meta.label}
            </span>
          </div>
        </div>

        {/* 2-col main */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
          {/* Sol kolon */}
          <div className="space-y-5">
            {/* Items */}
            <Card padding="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold">
                  Ürünler ({order.items.length})
                </h2>
                <span className="text-[12.5px] text-gri-700 tabular-nums">
                  Ara toplam: {formatCurrency(order.subtotal)}
                </span>
              </div>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-3 rounded-lg ring-1 ring-gri-200"
                  >
                    <span className="grid place-items-center w-12 h-12 rounded-lg bg-pim-mercan-tint text-pim-mercan shrink-0">
                      {item.product === "sticker" ? (
                        <Icon.Sticker size={20} />
                      ) : (
                        <Icon.Roll size={20} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] truncate">
                        {item.title}
                      </div>
                      <div className="text-[12px] text-gri-700 mt-0.5">
                        {item.config}
                      </div>
                      <div className="text-[11.5px] text-gri-500 mt-1 tabular-nums">
                        {item.qty.toLocaleString("tr-TR")} adet ·{" "}
                        {formatCurrency(item.unit)}/adet
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold tabular-nums">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Prova upload — operator_review ve qc_passed durumları için */}
            {(order.status === "operator_review" ||
              order.status === "qc_pending" ||
              order.status === "paid") && (
              <Card padding="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0">
                    <Icon.Sparkle size={18} />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-[15px] font-semibold">
                      Prova hazırla & yükle
                    </h2>
                    <p className="text-[12px] text-gri-700 mt-0.5">
                      Müşteriye gösterilecek mockup'ı yükle (PDF, PNG veya JPG).
                      Yükledikten sonra sipariş{" "}
                      <strong>prova bekleme</strong> durumuna geçer.
                    </p>
                  </div>
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    disabled={proofUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleProofUpload(file);
                    }}
                    className="block w-full text-[13px] file:mr-3 file:px-3 file:h-9 file:rounded-lg file:border-0 file:bg-pim-mercan file:text-white file:font-semibold file:cursor-pointer file:hover:bg-pim-mercan/90 disabled:opacity-50"
                  />
                </label>
                {proofUploading && (
                  <p className="text-[12px] text-pim-mercan mt-2">
                    Yükleniyor…
                  </p>
                )}
                <p className="text-[11px] text-gri-500 mt-3 leading-relaxed">
                  Maksimum 30 MB · Müşteri /siparis/{order.id} sayfasında onay
                  butonu görür.
                </p>
              </Card>
            )}

            {order.status === "proof_pending" && (
              <Card
                padding="p-5"
                className="!bg-sari-soft !ring-sari/30"
              >
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-sari/20 text-sari-koyu shrink-0">
                    <Icon.Info size={18} />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-[14px] font-semibold text-sari-koyu">
                      Prova yüklendi — müşteri onayı bekleniyor
                    </h2>
                    <p className="text-[12.5px] text-sari-koyu/85 mt-1 leading-relaxed">
                      Müşteri /siparis/{order.id} sayfasından "Provayı onayla"
                      veya "Değişiklik iste" butonuna basacak.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Baskı manifest indir — Mig 063 (E öbeği). Sadece üretim
                aşamasındaki siparişler için. JSON içinde signed SVG URL'leri
                + tüm POC v2 meta (material, white_plan, tier, ...) var. */}
            {(order.status === "proof_approved" ||
              order.status === "ready_to_ship" ||
              order.status === "fason_assigned" ||
              order.status === "in_production") && (
              <Card
                padding="p-5"
                className="!bg-yesil-soft !ring-yesil/30"
              >
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-yesil/20 text-yesil shrink-0">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <div className="flex-1">
                    <h2 className="text-[14px] font-semibold text-yesil">
                      Baskı manifesti hazır
                    </h2>
                    <p className="text-[12.5px] text-yesil/85 mt-1 leading-relaxed">
                      Müşteri onaylı cutline'lar + meta (malzeme/beyaz
                      plan/tier) + SVG signed URL'leri içeren JSON paket. RIP
                      sisteminize alabilirsiniz. URL'ler 1 saat geçerli.
                    </p>
                    <a
                      href={`/api/admin/print-job/${order.id}/manifest`}
                      download={`print-manifest-${order.id}.json`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-yesil px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-yesil-koyu"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Manifest JSON indir
                    </a>
                  </div>
                </div>
              </Card>
            )}

            {/* Fason atama — sipariş prova_pending'ten sonra (müşteri onayladıktan sonra)
                veya operator_review (manuel) durumunda gösterilir */}
            {(order.status === "operator_review" ||
              order.status === "in_production") &&
              !assignmentInfo && (
                <Card padding="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0">
                      <Icon.Truck size={18} />
                    </span>
                    <div className="flex-1">
                      <h2 className="text-[15px] font-semibold">
                        Fason'a gönder
                      </h2>
                      <p className="text-[12px] text-gri-700 mt-0.5">
                        Sistem performans skoru + uygunluğa göre öneriyor. Tek
                        tıkla atama yapabilirsin.
                      </p>
                    </div>
                  </div>

                  {fasonSuggestions.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const specialty =
                          order.items[0]?.product === "etiket"
                            ? "etiket"
                            : "sticker";
                        void loadFasonSuggestions(specialty);
                      }}
                      className="w-full h-10 rounded-lg bg-pim-mercan-tint text-pim-mercan text-[13px] font-semibold hover:bg-pim-mercan/15"
                    >
                      Önerilen fasonları getir
                    </button>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4">
                        {fasonSuggestions.map((f) => {
                          const isSelected = selectedFasonId === f.fason_id;
                          const scoreColor =
                            f.cached_score === null
                              ? "text-gri-500"
                              : f.cached_score >= 0.9
                                ? "text-yesil"
                                : f.cached_score >= 0.7
                                  ? "text-pim-mercan"
                                  : "text-kirmizi";
                          return (
                            <label
                              key={f.fason_id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg ring-1 cursor-pointer transition-colors",
                                isSelected
                                  ? "ring-pim-mercan bg-pim-mercan-tint"
                                  : "ring-gri-200 bg-white hover:ring-pim-mercan/40"
                              )}
                            >
                              <input
                                type="radio"
                                name="fason"
                                value={f.fason_id}
                                checked={isSelected}
                                onChange={() => setSelectedFasonId(f.fason_id)}
                                className="accent-pim-mercan"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[13.5px]">
                                  {f.fason_name}
                                </div>
                                <div className="text-[11px] text-gri-700">
                                  {f.reason} · {f.active_count} aktif iş
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "text-[13px] font-bold tabular-nums",
                                  scoreColor
                                )}
                              >
                                {f.cached_score !== null
                                  ? `${(f.cached_score * 100).toFixed(0)}%`
                                  : "—"}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <label className="block">
                          <span className="text-[12px] font-semibold text-gri-700 mb-1 block">
                            Teslim tarihi
                          </span>
                          <input
                            type="date"
                            value={fasonDeliveryDate}
                            onChange={(e) =>
                              setFasonDeliveryDate(e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 text-[13px] focus:ring-2 focus:ring-pim-mercan/40 focus:outline-none"
                          />
                        </label>
                      </div>

                      <label className="block mb-4">
                        <span className="text-[12px] font-semibold text-gri-700 mb-1 block">
                          Not (opsiyonel)
                        </span>
                        <textarea
                          value={fasonNotes}
                          onChange={(e) => setFasonNotes(e.target.value)}
                          rows={2}
                          placeholder="Özel istek, dikkat edilecek nokta..."
                          className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 text-[13px] focus:ring-2 focus:ring-pim-mercan/40 focus:outline-none resize-none"
                        />
                      </label>

                      <Button
                        variant="primary"
                        block
                        onClick={() => void handleFasonAssign()}
                        disabled={assigning || !selectedFasonId}
                      >
                        {assigning
                          ? "Atanıyor..."
                          : "Fason'a gönder"}
                      </Button>
                    </>
                  )}
                </Card>
              )}

            {assignmentInfo && (
              <Card padding="p-5" className="!bg-yesil-soft !ring-yesil/30">
                <div className="flex items-start gap-3 mb-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-yesil/20 text-yesil shrink-0">
                    <Icon.Check size={18} />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-[15px] font-semibold text-yesil">
                      Fason'a atandı: {assignmentInfo.fasonName}
                    </h2>
                    <p className="text-[12px] text-yesil/85 mt-0.5">
                      Mail kuyruğa alındı (Resend gelince gönderilecek). Şimdilik
                      aşağıdaki linki manuel paylaşabilirsin:
                    </p>
                  </div>
                </div>
                <div className="flex items-stretch gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-white ring-1 ring-yesil/30 font-mono text-[12px] text-lacivert overflow-x-auto whitespace-nowrap">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}/fason/${assignmentInfo.fasonToken}`
                      : `/fason/${assignmentInfo.fasonToken}`}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        const link = `${window.location.origin}/fason/${assignmentInfo.fasonToken}`;
                        void navigator.clipboard.writeText(link);
                        toast.success("Link kopyalandı");
                      }
                    }}
                    className="px-3 rounded-lg bg-yesil text-white text-[12px] font-semibold hover:bg-yesil/90"
                  >
                    Kopyala
                  </button>
                </div>
              </Card>
            )}

            {/* Müşteri */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-4">
                Müşteri bilgileri
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13.5px]">
                <Field label="Ad / Marka" value={order.address.name} />
                <Field label="Telefon" value={order.address.phone} />
                <Field
                  label="Şehir"
                  value={order.address.city || "—"}
                />
                <Field
                  label="Adres"
                  value={order.address.addr || "—"}
                  fullWidth
                />
              </div>
            </Card>

            {/* Fatura */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-4">Fatura</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13.5px]">
                <Field
                  label="Tip"
                  value={
                    order.invoice.type === "individual"
                      ? "Bireysel (TC)"
                      : "Kurumsal (VKN)"
                  }
                />
                {order.invoice.type === "individual" ? (
                  <Field
                    label="TC Kimlik"
                    value={order.invoice.tc || "—"}
                  />
                ) : (
                  <>
                    <Field label="VKN" value={order.invoice.vkn || "—"} />
                    <Field
                      label="Şirket ünvanı"
                      value={order.invoice.companyName || "—"}
                      fullWidth
                    />
                    <Field
                      label="Vergi dairesi"
                      value={order.invoice.taxOffice || "—"}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* Ödeme */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-4">Ödeme</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13.5px]">
                <Field
                  label="Yöntem"
                  value={
                    order.payment.method === "card"
                      ? "Kart"
                      : "Havale / EFT"
                  }
                />
                {order.payment.masked && (
                  <Field label="Detay" value={order.payment.masked} />
                )}
                <Field
                  label="Tahmini teslim"
                  value={
                    order.estimatedDelivery
                      ? new Date(order.estimatedDelivery).toLocaleDateString(
                          "tr-TR",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }
                        )
                      : "Hesaplanmadı"
                  }
                />
              </div>
            </Card>
          </div>

          {/* Sağ kolon — aksiyonlar + özet */}
          <div className="space-y-5 lg:sticky lg:top-[80px] lg:self-start">
            {/* Status değiştir */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-3">
                Durum güncelle
              </h2>
              <p className="text-[12px] text-gri-700 mb-3">
                Operatör manuel durum değişikliği yapabilir.
              </p>
              <div className="space-y-2">
                {ALL_STATUSES.map((s) => {
                  const m = STATUS_META[s];
                  const active = s === order.status;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={updating || active}
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 h-9 rounded-lg text-[12.5px] font-semibold transition-colors text-left",
                        active
                          ? "bg-lacivert text-white cursor-default"
                          : "bg-white ring-1 ring-gri-200 hover:ring-pim-mercan text-lacivert hover:bg-gri-50"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block w-2 h-2 rounded-full shrink-0",
                          active ? "bg-white" : m.color.replace("text-", "bg-")
                        )}
                      />
                      <span className="flex-1 truncate">{m.label}</span>
                      {active && <Icon.Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Özet */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-3">Özet</h2>
              <div className="space-y-2 text-[13.5px]">
                <SummaryRow
                  label="Ara toplam"
                  value={formatCurrency(order.subtotal)}
                />
                <SummaryRow
                  label="Kargo"
                  value={
                    order.shipping === 0
                      ? "Ücretsiz"
                      : formatCurrency(order.shipping)
                  }
                  accent={order.shipping === 0 ? "text-yesil" : undefined}
                />
                <div className="h-px bg-gri-200 my-2" />
                <SummaryRow
                  label="Toplam (KDV dahil)"
                  value={formatCurrency(order.total)}
                  bold
                />
              </div>
            </Card>

            {/* Hızlı aksiyonlar */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-3">
                Hızlı aksiyonlar
              </h2>
              <div className="space-y-2">
                <Link
                  href={`/siparis/${order.id}`}
                  target="_blank"
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg ring-1 ring-gri-200 bg-white text-lacivert text-[13px] font-semibold hover:bg-gri-50"
                >
                  <Icon.Eye size={14} /> Müşteri olarak gör
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.print();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg ring-1 ring-gri-200 bg-white text-lacivert text-[13px] font-semibold hover:bg-gri-50"
                >
                  <Icon.Doc size={14} /> Yazdır
                </button>
                <Link
                  href="/admin/siparisler"
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg ring-1 ring-gri-200 bg-white text-gri-700 text-[13px] font-semibold hover:bg-gri-50"
                >
                  ← Listeye dön
                </Link>
              </div>
            </Card>

            {/* Sefa 19 May: Kargo etiketi PDF (100×150mm termal).
                tracking yoksa geçici cargoKey ile basılır — şubeye götür,
                barkod al, AdminTrackingForm'a gir, yeniden indir. */}
            {order.status !== "cancelled" && (
              <Card padding="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0">
                    <Icon.Doc size={18} />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-[15px] font-semibold">
                      Kargo Etiketi
                    </h2>
                    <p className="text-[12px] text-gri-700 mt-0.5 leading-relaxed">
                      100 × 150 mm termal etiket (PDF). Paketin üzerine
                      yapıştır, şubeye götür. Şubeden barkod aldıktan sonra
                      aşağıdaki forma gir ve etiketi yeniden indir.
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/admin/shipping/label/${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-pim-mercan text-white text-[13px] font-semibold hover:bg-pim-mercan/90"
                >
                  <Icon.Doc size={14} /> PDF indir
                </a>
              </Card>
            )}

            {/* Sefa 18 May: Yurtiçi Kargo manuel tracking + durum geçmişi */}
            <AdminTrackingForm orderId={order.id} />
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Helpers
// ============================================================

function Field({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <div className="text-[10.5px] uppercase tracking-[0.04em] text-gri-500 font-semibold mb-0.5">
        {label}
      </div>
      <div className="text-[13.5px] text-lacivert font-medium">{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gri-700">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          bold ? "font-bold text-[16px] text-lacivert" : "",
          accent
        )}
      >
        {value}
      </span>
    </div>
  );
}
