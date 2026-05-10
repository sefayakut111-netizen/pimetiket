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
import { Card, Button, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  paid: { label: "Yeni — dosya bekleniyor", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_pending: { label: "AI kontrol", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_flagged: { label: "AI flag — manuel kontrol", color: "text-sari", bg: "bg-sari-soft" },
  operator_review: { label: "Operatör inceliyor", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  proof_pending: { label: "Prova hazır — müşteri onayı", color: "text-lacivert", bg: "bg-gri-100" },
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
        <div className="mx-auto max-w-[640px] px-6 text-center text-gri-500">
          Yükleniyor…
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
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-sari/20 text-[#7A560A] shrink-0">
                    <Icon.Info size={18} />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-[14px] font-semibold text-[#7A560A]">
                      Prova yüklendi — müşteri onayı bekleniyor
                    </h2>
                    <p className="text-[12.5px] text-[#7A560A]/85 mt-1 leading-relaxed">
                      Müşteri /siparis/{order.id} sayfasından "Provayı onayla"
                      veya "Değişiklik iste" butonuna basacak.
                    </p>
                  </div>
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
                      : order.payment.method === "wallet"
                        ? "Cüzdan"
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
