/**
 * Pim Etiket — /admin/prova (E.3)
 *
 * Prova üretimi: müşteri tasarımını render edip onay bekleyen siparişler.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";
import { fetchAllOrdersForAdmin } from "@/lib/admin-orders";
import { excludeTestOrders } from "@/lib/admin-order-filters";

const PROOF_STATUSES = [
  "proof_generating",
  "proof_validating",
  "proof_pending",
  "proof_approved",
] as const;

const PROOF_STATUS_META: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  proof_generating: {
    label: "Hazırlanıyor",
    bg: "bg-gri-100",
    color: "text-lacivert",
  },
  proof_validating: {
    label: "Doğrulanıyor",
    bg: "bg-gri-100",
    color: "text-lacivert",
  },
  proof_pending: {
    label: "Onay bekliyor",
    bg: "bg-sari-soft",
    color: "text-sari-koyu",
  },
  proof_approved: {
    label: "Onaylandı ✓",
    bg: "bg-yesil-soft",
    color: "text-yesil-koyu",
  },
};

type ProofFilter = "all" | "generating" | "pending" | "approved";

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

function whatsappPhone(phone: string | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return `90${digits}`;
}

function ProofSlaTag({
  createdAt,
  status,
}: {
  createdAt: number;
  status: string;
}) {
  if (status !== "proof_pending") return null;

  const elapsedMs = Date.now() - createdAt;
  const elapsedHours = elapsedMs / 3600000;
  const remainingHours = 36 - elapsedHours;

  if (remainingHours <= 0) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-kirmizi text-white text-[11px] font-bold animate-pulse">
        ⏰ SLA AŞILDI — otomatik iade tetiklenecek
      </span>
    );
  }

  if (remainingHours <= 6) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-kirmizi-soft text-kirmizi-koyu text-[11px] font-bold">
        🔴 {Math.floor(remainingHours)} sa kaldı
      </span>
    );
  }

  if (remainingHours <= 12) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-sari-soft text-sari-koyu text-[11px] font-bold">
        ⏰ {Math.floor(remainingHours)} sa kaldı
      </span>
    );
  }

  return (
    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
      ⏳ {Math.floor(remainingHours)} sa kaldı
    </span>
  );
}

function ProofReadinessIndicator({ status }: { status: string }) {
  const steps = [
    {
      label: "Bıçak",
      done: ["proof_pending", "proof_approved", "proof_validating"].includes(
        status
      ),
      icon: "✂️",
    },
    {
      label: "Beyaz",
      done: ["proof_pending", "proof_approved", "proof_validating"].includes(
        status
      ),
      icon: "⬜",
    },
    {
      label: "Doğrulama",
      done: ["proof_pending", "proof_approved"].includes(status),
      icon: "🤖",
    },
  ];

  return (
    <div className="flex items-center gap-3 mt-2 flex-wrap">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1 text-[11px]">
          <span>{s.icon}</span>
          <span
            className={
              s.done ? "text-yesil font-semibold" : "text-gri-400"
            }
          >
            {s.label} {s.done ? "✓" : "…"}
          </span>
        </div>
      ))}
    </div>
  );
}

function DesignThumb({
  orderId,
  itemId,
  fallbackIsEtiket,
}: {
  orderId: string;
  itemId: string;
  fallbackIsEtiket: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/orders/${orderId}/items/${itemId}/design-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.url) setUrl(d.url);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, itemId]);

  if (url && !error) {
    return (
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gri-100 shrink-0">
        <Image
          src={url}
          alt="Tasarım"
          fill
          sizes="80px"
          className="object-contain"
          unoptimized
          onError={() => setError(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid place-items-center w-20 h-20 rounded-lg shrink-0",
        fallbackIsEtiket ? "bg-krem" : "bg-pim-mercan-tint"
      )}
    >
      {fallbackIsEtiket ? (
        <Icon.Roll size={32} className="text-lacivert" />
      ) : (
        <Icon.Sticker size={32} className="text-pim-mercan" />
      )}
    </div>
  );
}

export default function AdminProvaPage() {
  const toast = useToast();
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([]);
  const [filter, setFilter] = useState<ProofFilter>("pending");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showTestOrders, setShowTestOrders] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const applyOrders = (all: CustomerOrder[]) => {
      if (cancelled) return;
      setAllOrders(all);
    };
    applyOrders(listCustomerOrders());
    void fetchAllOrdersForAdmin({ limit: 500 }).then(applyOrders);
    const refresh = () => {
      applyOrders(listCustomerOrders());
      void fetchAllOrdersForAdmin({ limit: 500 }).then(applyOrders);
    };
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("pim_customer_orders_updated", refresh);
    };
  }, []);

  const catalogOrders = useMemo(
    () => (showTestOrders ? allOrders : excludeTestOrders(allOrders)),
    [allOrders, showTestOrders]
  );
  const hiddenTestCount = allOrders.length - catalogOrders.length;

  const items = useMemo(
    () =>
      catalogOrders.filter((o) =>
        (PROOF_STATUSES as readonly string[]).includes(o.status)
      ),
    [catalogOrders]
  );

  const inReview = catalogOrders.filter(
    (o) => o.status === "operator_review"
  ).length;
  const proofPending = items.filter((o) => o.status === "proof_pending").length;
  const inProduction = catalogOrders.filter(
    (o) => o.status === "in_production"
  ).length;
  const flagged = catalogOrders.filter((o) => o.status === "qc_flagged").length;

  const counts = useMemo(
    () => ({
      all: items.length,
      generating: items.filter(
        (o) =>
          o.status === "proof_generating" || o.status === "proof_validating"
      ).length,
      pending: items.filter((o) => o.status === "proof_pending").length,
      approved: items.filter((o) => o.status === "proof_approved").length,
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "generating":
        return items.filter(
          (o) =>
            o.status === "proof_generating" || o.status === "proof_validating"
        );
      case "pending":
        return items.filter((o) => o.status === "proof_pending");
      case "approved":
        return items.filter((o) => o.status === "proof_approved");
      default:
        return items;
    }
  }, [items, filter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (a.status === "proof_pending" && b.status !== "proof_pending") {
        return -1;
      }
      if (a.status !== "proof_pending" && b.status === "proof_pending") {
        return 1;
      }
      return a.createdAt - b.createdAt;
    });
  }, [filteredItems]);

  const approvedOrders = useMemo(
    () => items.filter((o) => o.status === "proof_approved"),
    [items]
  );

  const last30Stats = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = catalogOrders.filter((o) => o.createdAt >= cutoff);
    const approved = recent.filter((o) =>
      [
        "proof_approved",
        "ready_to_ship",
        "in_production",
        "shipped",
        "delivered",
      ].includes(o.status)
    ).length;
    const cancelled = recent.filter((o) => o.status === "cancelled").length;
    const proofDone = recent.filter((o) =>
      ["in_production", "shipped", "delivered"].includes(o.status)
    );
    const avgDays =
      proofDone.length > 0
        ? proofDone.reduce(
            (s, o) => s + (Date.now() - o.createdAt) / 86400000,
            0
          ) / proofDone.length
        : 0;
    return { approved, cancelled, total: recent.length, avgDays };
  }, [catalogOrders]);

  const callStatusApi = async (
    orderId: string,
    status: string,
    note: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Güncelleme başarısız: ${j.error ?? res.status}`);
        return false;
      }
      updateCustomerOrderStatus(orderId, status as OrderStatus);
      window.dispatchEvent(new Event("pim_customer_orders_updated"));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bilinmeyen hata";
      toast.error(`Ağ hatası: ${msg}`);
      return false;
    }
  };

  const handleApprove = async (order: CustomerOrder) => {
    const ok = await callStatusApi(
      order.id,
      "in_production",
      "Prova kuyruğundan üretime al (admin)"
    );
    if (ok) toast.success(`${order.id} → Üretime alındı`);
  };

  const handleReminder = async (order: CustomerOrder) => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/remind-proof`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "email" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 429) {
          toast.error(j.error ?? "24 saat içinde zaten gönderildi");
        } else {
          toast.error(`Hatırlatma gönderilemedi: ${j.error ?? res.status}`);
        }
        return;
      }
      toast.success(`${order.id} müşterisine prova hatırlatma maili gönderildi`);
    } catch {
      toast.error("Hatırlatma gönderilemedi (ağ hatası)");
    }
  };

  const handleCancel = async (order: CustomerOrder) => {
    if (!confirm(`${order.id} siparişini iptal etmek istiyor musun?`)) return;
    const ok = await callStatusApi(
      order.id,
      "cancelled",
      "Prova kuyruğundan iptal (admin)"
    );
    if (ok) toast.info(`${order.id} iptal edildi`);
  };

  const bulkApprove = async () => {
    if (approvedOrders.length === 0) return;
    if (
      !confirm(
        `${approvedOrders.length} siparişi üretime almak istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    setBulkLoading(true);
    let ok = 0;
    try {
      for (const o of approvedOrders) {
        const success = await callStatusApi(
          o.id,
          "in_production",
          "Toplu üretime alma (admin)"
        );
        if (success) ok++;
      }
      toast.success(`${ok}/${approvedOrders.length} sipariş üretime alındı`);
    } finally {
      setBulkLoading(false);
    }
  };

  const renderActionButtons = (p: CustomerOrder) => {
    const proofUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/onay/${p.id}`
        : `/onay/${p.id}`;
    const waPhone = whatsappPhone(p.address?.phone);
    const isSystemProcessing =
      p.status === "proof_generating" || p.status === "proof_validating";

    if (isSystemProcessing) {
      return (
        <p className="text-[12px] text-gri-500 italic shrink-0 max-w-[140px]">
          Sistem işliyor — müdahale gerekmez
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-2 shrink-0">
        <Button variant="primary" size="sm" onClick={() => handleApprove(p)}>
          <Icon.Check size={12} /> Üretime al
        </Button>
        {p.status === "proof_pending" && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleReminder(p)}
            >
              Hatırlat
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleCancel(p)}>
              İptal et
            </Button>
          </>
        )}
        {(p.status === "proof_pending" || p.status === "proof_approved") && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(proofUrl);
                toast.success("Prova linki kopyalandı");
              }}
            >
              🔗 Link kopyala
            </Button>
            {waPhone && (
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `Merhaba ${p.address?.name ?? ""}, siparişinizin baskı provası hazır! Onaylamak için:\n${proofUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg ring-1 ring-gri-200 bg-white text-[12.5px] font-semibold text-yesil hover:ring-yesil"
              >
                💬 WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
          <Eyebrow>Prova üretim</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Prova kuyruğu
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {items.length === 0
              ? "Prova sürecinde sipariş yok."
              : `${items.length} sipariş prova akışında · ${counts.pending} onay bekliyor`}
            {hiddenTestCount > 0 && (
              <span className="ml-2 text-[12.5px] text-gri-500">
                ({hiddenTestCount} test siparişi gizli)
              </span>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-gri-700 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={showTestOrders}
            onChange={(e) => setShowTestOrders(e.target.checked)}
            className="rounded border-gri-300 text-pim-mercan focus:ring-pim-mercan"
          />
          Test siparişlerini göster
        </label>
      </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {(
            [
              {
                label: "Operatör inceliyor",
                count: inReview,
                accent: "text-pim-mercan",
                bg: "bg-pim-mercan-tint",
              },
              {
                label: "Onay bekliyor",
                count: proofPending,
                accent: "text-sari-koyu",
                bg: "bg-sari-soft",
              },
              {
                label: "Üretimde",
                count: inProduction,
                accent: "text-yesil",
                bg: "bg-yesil-soft",
              },
              {
                label: "AI flag",
                count: flagged,
                accent: "text-kirmizi",
                bg: "bg-kirmizi/10",
              },
            ] as const
          ).map((k) => (
            <Card key={k.label} padding="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid place-items-center w-10 h-10 rounded-xl shrink-0",
                    k.bg,
                    k.accent
                  )}
                >
                  <Icon.Check size={16} />
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    {k.label}
                  </div>
                  <div
                    className={cn("text-2xl font-bold tabular-nums", k.accent)}
                  >
                    {k.count}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-5 text-[12px] text-gri-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>📊 Son 30 gün: {last30Stats.total} sipariş</span>
          <span>✅ {last30Stats.approved} onaylandı</span>
          <span>❌ {last30Stats.cancelled} iptal</span>
          {last30Stats.avgDays > 0 && (
            <span>Sipariş → onay arası ort.: {last30Stats.avgDays.toFixed(1)} gün</span>
          )}
        </div>

        {approvedOrders.length > 0 && (
          <div className="mb-4 rounded-lg bg-yesil-soft/30 ring-1 ring-yesil/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-yesil-koyu font-medium">
              ✅ {approvedOrders.length} sipariş müşteri tarafından onaylandı —
              üretime alınabilir
            </span>
            <Button
              variant="primary"
              size="sm"
              className="!bg-yesil hover:!bg-yesil-koyu"
              onClick={() => void bulkApprove()}
              disabled={bulkLoading}
            >
              Tümünü üretime al ({approvedOrders.length})
            </Button>
          </div>
        )}

        <div className="flex gap-2 mb-5 flex-wrap">
          {(
            [
              { id: "pending" as const, label: "Onay Bekliyor", emoji: "⏳" },
              { id: "generating" as const, label: "Hazırlanıyor", emoji: "⚙️" },
              { id: "approved" as const, label: "Onaylandı", emoji: "✅" },
              { id: "all" as const, label: "Tümü", emoji: "📋" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                filter === f.id
                  ? "bg-lacivert text-white"
                  : "bg-gri-100 text-gri-700 hover:bg-gri-200"
              )}
            >
              {f.emoji} {f.label} ({counts[f.id]})
            </button>
          ))}
        </div>

        {sortedItems.length === 0 ? (
          <Card padding="p-10" className="text-center">
            <Pim pose="happy" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {items.length === 0
                ? "Prova kuyruğu temiz 🎉"
                : "Bu filtrede sipariş yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {items.length === 0
                ? "Prova sürecinde sipariş yok. Yeni siparişler operatör incelemesinden geçince burada görünür."
                : "Başka bir filtre sekmesine geçin veya tümünü görüntüleyin."}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedItems.map((p) => {
              const product =
                p.items.length === 1
                  ? p.items[0].title
                  : `${p.items.length} ürün`;
              const config = p.items
                .map((i) => i.config)
                .join(" · ")
                .slice(0, 100);
              const meta =
                PROOF_STATUS_META[p.status] ?? PROOF_STATUS_META.proof_pending;

              return (
                <Card key={p.id} padding="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className="font-mono text-[12.5px] text-gri-700">
                          {p.id}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            meta.bg,
                            meta.color
                          )}
                        >
                          {meta.label}
                        </span>
                        <ProofSlaTag createdAt={p.createdAt} status={p.status} />
                      </div>
                      <div className="font-semibold text-base">
                        {p.address.name}
                      </div>
                      <div className="text-[13px] text-gri-700 mt-0.5">
                        {product}{" "}
                        <span className="text-gri-500">· {config}</span>
                      </div>
                      <div className="text-[12px] text-gri-500 mt-1 tabular-nums">
                        Sipariş: {timeAgo(p.createdAt)} · {fmt(p.total)} ₺
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {p.items.map((it) => (
                          <DesignThumb
                            key={it.id}
                            orderId={p.id}
                            itemId={it.id}
                            fallbackIsEtiket={it.product === "etiket"}
                          />
                        ))}
                      </div>
                      <ProofReadinessIndicator status={p.status} />

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link
                          href={`/admin/siparisler/${p.id}`}
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-lacivert hover:underline"
                        >
                          Admin sipariş detayı →
                        </Link>
                        <Link
                          href={`/admin/prova/${p.id}`}
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-pim-mercan hover:underline"
                        >
                          Tam ekran incele (tasarım + bıçak) →
                        </Link>
                      </div>
                    </div>
                    {renderActionButtons(p)}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card padding="p-5" className="mt-6 !bg-krem">
          <div className="flex gap-4 items-center">
            <Pim pose="inspect" size={80} bob={false} />
            <div className="flex-1">
              <h3 className="font-bold text-base mb-0.5">
                Pim ipucu: Prova kalitesi
              </h3>
              <p className="text-[13px] text-gri-700 leading-relaxed">
                Provayı PDF olarak gönderdiğinde renk kalibrasyonu için CMYK
                profilini ekle. Müşteriler genellikle ekrandaki rengi gerçek
                baskıyla aynı sanır — bu yüzden prova sayfasında uyarı kutusu
                otomatik gösterilir.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

