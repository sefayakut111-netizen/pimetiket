/**
 * Pim Etiket — /admin/prova (E.3)
 *
 * Prova üretimi: müşteri tasarımını render edip onay bekleyen siparişler.
 */

"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { StatusDot } from "@/components/admin/ui";

const PROOF_STATUSES = [
  "proof_generating",
  "proof_validating",
  "proof_pending",
  "proof_approved",
  "operator_print_review",
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
    label: "Onaylandı ",
    bg: "bg-yesil-soft",
    color: "text-yesil-koyu",
  },
  operator_print_review: {
    label: "Baskı incelemesi",
    bg: "bg-mavi-soft",
    color: "text-mavi-koyu",
  },
  cancelled: {
    label: "İptal",
    bg: "bg-gri-100",
    color: "text-gri-700",
  },
  human_review_failed: {
    label: "Reddedildi",
    bg: "bg-kirmizi-soft",
    color: "text-kirmizi-koyu",
  },
};

type ProofFilter =
  | "all"
  | "generating"
  | "validating"
  | "pending"
  | "approved"
  | "rejected"
  | "sla_breached";

type ReadinessLevel = "ok" | "cutline_only" | "missing";

type OrderReadiness = {
  level: ReadinessLevel;
  hasCutline: boolean;
  hasWhite: boolean;
};

const SLA_MS = 36 * 60 * 60 * 1000;

function isProofSlaBreached(createdAt: number, status: string): boolean {
  if (status !== "proof_pending") return false;
  return Date.now() - createdAt > SLA_MS;
}

const READINESS_BADGE: Record<
  ReadinessLevel,
  { emoji: string; label: string; className: string }
> = {
  ok: {
    emoji: "🟢",
    label: "Bıçak + beyaz",
    className: "bg-yesil-soft text-yesil-koyu",
  },
  cutline_only: {
    emoji: "🟡",
    label: "Bıçak var, beyaz eksik",
    className: "bg-sari-soft text-sari-koyu",
  },
  missing: {
    emoji: "🔴",
    label: "Bıçak / beyaz eksik",
    className: "bg-kirmizi-soft text-kirmizi-koyu",
  },
};

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

function formatProofWaitDetail(hours: number): string {
  const h = Math.floor(hours);
  if (h >= 24) {
    const days = Math.floor(h / 24);
    return `${h} saat (${days} gün)`;
  }
  return `${h} saat`;
}

function ProofSlaTag({
  createdAt,
  status,
  autoRefundHealthy,
}: {
  createdAt: number;
  status: string;
  autoRefundHealthy: boolean;
}) {
  if (status !== "proof_pending") return null;

  const elapsedMs = Date.now() - createdAt;
  const elapsedHours = elapsedMs / 3600000;
  const remainingHours = 36 - elapsedHours;

  if (remainingHours <= 0) {
    const slaDetail = formatProofWaitDetail(elapsedHours);
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full bg-kirmizi text-white text-[11px] font-bold animate-pulse">
        <StatusDot color="gri" className="!bg-white" />
        {autoRefundHealthy
          ? `SLA asildi · ${slaDetail} — otomatik iade tetiklenecek`
          : `SLA asildi · ${slaDetail} — otomatik iade pasif, manuel islem gerekli`}
      </span>
    );
  }

  if (remainingHours <= 6) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-kirmizi-soft text-kirmizi-koyu text-[11px] font-bold">
         {Math.floor(remainingHours)} sa kaldı
      </span>
    );
  }

  if (remainingHours <= 12) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full bg-sari-soft text-sari-koyu text-[11px] font-bold">
        <StatusDot color="sari" />
        {Math.floor(remainingHours)} sa kaldı
      </span>
    );
  }

  return (
    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
      {Math.floor(remainingHours)} sa kaldı
    </span>
  );
}

function CutlineReadinessBadge({
  readiness,
}: {
  readiness: OrderReadiness | undefined;
}) {
  const level = readiness?.level ?? "missing";
  const meta = READINESS_BADGE[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold mt-2",
        meta.className
      )}
      title={meta.label}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
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
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-56px)]" />}>
      <AdminProvaPageInner />
    </Suspense>
  );
}

function filterForOrderStatus(status: string): ProofFilter {
  switch (status) {
    case "proof_generating":
      return "generating";
    case "proof_validating":
      return "validating";
    case "proof_pending":
      return "pending";
    case "proof_approved":
      return "approved";
    case "operator_print_review":
      return "pending";
    default:
      return "all";
  }
}

function AdminProvaPageInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const deepLinkOrder = searchParams.get("order");
  const scrolledOrderRef = useRef<string | null>(null);
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([]);
  const [filter, setFilter] = useState<ProofFilter>("pending");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showTestOrders, setShowTestOrders] = useState(false);
  const [autoRefundHealthy, setAutoRefundHealthy] = useState(true);
  const [hasContractedPartner, setHasContractedPartner] = useState(false);
  const [reminderLog, setReminderLog] = useState<
    Record<string, { lastAt: string; count: number }>
  >({});
  const [readinessMap, setReadinessMap] = useState<
    Record<string, OrderReadiness>
  >({});
  const [kpi, setKpi] = useState({
    pending: 0,
    approvedToday: 0,
    avgResponseHours: 0,
    slaBreached: 0,
  });

  useEffect(() => {
    void fetch("/api/admin/system-health")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: { ok?: boolean; autoRefundHealthy?: boolean } | null) => {
          if (data?.ok && typeof data.autoRefundHealthy === "boolean") {
            setAutoRefundHealthy(data.autoRefundHealthy);
          }
        }
      )
      .catch(() => {
        setAutoRefundHealthy(false);
      });
  }, []);

  useEffect(() => {
    void fetch("/api/admin/fason/partners", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          partners?: Array<{
            active?: boolean;
            status?: string;
            contract_signed_at?: string | null;
          }>;
        } | null) => {
          const partners = data?.partners ?? [];
          const contracted = partners.some(
            (p) =>
              (p.status === "active" || p.active === true) &&
              Boolean(p.contract_signed_at)
          );
          setHasContractedPartner(contracted);
        }
      )
      .catch(() => setHasContractedPartner(false));
  }, []);

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

  const rejectedItems = useMemo(
    () =>
      catalogOrders.filter(
        (o) => o.status === "cancelled" || o.status === "human_review_failed"
      ),
    [catalogOrders]
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      generating: items.filter((o) => o.status === "proof_generating").length,
      validating: items.filter((o) => o.status === "proof_validating").length,
      pending: items.filter(
        (o) =>
          o.status === "proof_pending" ||
          o.status === "operator_print_review"
      ).length,
      approved: items.filter((o) => o.status === "proof_approved").length,
      rejected: rejectedItems.length,
      sla_breached: items.filter(
        (o) => o.status === "proof_pending" && isProofSlaBreached(o.createdAt, o.status)
      ).length,
    }),
    [items, rejectedItems]
  );

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "generating":
        return items.filter((o) => o.status === "proof_generating");
      case "validating":
        return items.filter((o) => o.status === "proof_validating");
      case "pending":
        return items.filter(
          (o) =>
            o.status === "proof_pending" ||
            o.status === "operator_print_review"
        );
      case "approved":
        return items.filter((o) => o.status === "proof_approved");
      case "rejected":
        return rejectedItems;
      case "sla_breached":
        return items.filter(
          (o) =>
            o.status === "proof_pending" &&
            isProofSlaBreached(o.createdAt, o.status)
        );
      default:
        return items;
    }
  }, [items, rejectedItems, filter]);

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

  useEffect(() => {
    if (!deepLinkOrder) return;
    const target = catalogOrders.find((o) => o.id === deepLinkOrder);
    if (!target) return;
    setFilter(filterForOrderStatus(target.status));
    if (scrolledOrderRef.current === deepLinkOrder) return;
    scrolledOrderRef.current = deepLinkOrder;
    requestAnimationFrame(() => {
      document
        .getElementById(`prova-order-${deepLinkOrder}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [deepLinkOrder, catalogOrders, sortedItems]);

  const loadReminderLog = useCallback(async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setReminderLog({});
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/prova/reminder-log?orders=${encodeURIComponent(orderIds.join(","))}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        reminders?: Record<string, { lastAt: string; count: number }>;
      };
      if (data.ok && data.reminders) {
        setReminderLog(data.reminders);
      }
    } catch {
      /* sessiz */
    }
  }, []);

  useEffect(() => {
    const ids = sortedItems
      .filter((o) => o.status === "proof_pending")
      .map((o) => o.id);
    void loadReminderLog(ids);
  }, [sortedItems, loadReminderLog]);

  const loadReadiness = useCallback(async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setReadinessMap({});
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/prova/readiness?orderIds=${encodeURIComponent(orderIds.join(","))}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        readiness?: Record<string, OrderReadiness>;
      };
      if (data.ok && data.readiness) {
        setReadinessMap(data.readiness);
      }
    } catch {
      /* sessiz */
    }
  }, []);

  useEffect(() => {
    const ids = sortedItems.map((o) => o.id);
    void loadReadiness(ids);
  }, [sortedItems, loadReadiness]);

  useEffect(() => {
    void fetch("/api/admin/prova/readiness?stats=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            ok?: boolean;
            kpi?: {
              pending: number;
              approvedToday: number;
              avgResponseHours: number;
              slaBreached: number;
            };
          } | null
        ) => {
          if (data?.ok && data.kpi) setKpi(data.kpi);
        }
      )
      .catch(() => {
        /* client fallback below */
      });
  }, [catalogOrders]);

  const approvedOrders = useMemo(
    () => items.filter((o) => o.status === "proof_approved"),
    [items]
  );

  const kpiDisplay = useMemo(
    () => ({
      pending: items.filter(
        (o) =>
          o.status === "proof_pending" ||
          o.status === "operator_print_review"
      ).length,
      approvedToday: kpi.approvedToday,
      avgResponseHours: kpi.avgResponseHours,
      slaBreached: items.filter(
        (o) =>
          o.status === "proof_pending" &&
          isProofSlaBreached(o.createdAt, o.status)
      ).length,
    }),
    [items, kpi]
  );

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
    if (!hasContractedPartner) {
      toast.error(
        "Sozlesmeli partner yok — once partner sozlesmesi tamamlanmali"
      );
      return;
    }
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
      void loadReminderLog([order.id]);
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
    if (!hasContractedPartner) {
      toast.error(
        "Sozlesmeli partner yok — once partner sozlesmesi tamamlanmali"
      );
      return;
    }
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
    const reminderInfo = reminderLog[p.id];
    const reminderBlocked =
      reminderInfo?.lastAt != null &&
      Date.now() - new Date(reminderInfo.lastAt).getTime() < 24 * 60 * 60 * 1000;

    if (isSystemProcessing) {
      return (
        <p className="text-[12px] text-gri-500 italic shrink-0 max-w-[140px]">
          Sistem işliyor — müdahale gerekmez
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-2 shrink-0">
        <Button
          variant="primary"
          size="sm"
          disabled={!hasContractedPartner}
          title={
            !hasContractedPartner
              ? "Sozlesmeli partner yok — once partner sozlesmesi tamamlanmali"
              : undefined
          }
          onClick={() => void handleApprove(p)}
        >
          <Icon.Check size={12} />{" "}
          {hasContractedPartner ? "Üretime al" : "Üretime al (partner yok)"}
        </Button>
        {p.status === "proof_pending" && (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={reminderBlocked}
              title={
                reminderBlocked
                  ? "24 saat icinde zaten hatirlatma gonderildi"
                  : undefined
              }
              onClick={() => void handleReminder(p)}
            >
              Hatırlat
              {reminderInfo && reminderInfo.count > 0
                ? ` (${reminderInfo.count})`
                : ""}
            </Button>
            {reminderInfo?.lastAt && (
              <span className="text-[11px] text-gri-500">
                Son hatirlatma: {timeAgo(new Date(reminderInfo.lastAt).getTime())}
              </span>
            )}
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
               Link kopyala
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
                 WhatsApp
              </a>
            )}
            <a
              href={`mailto:?subject=${encodeURIComponent(
                `Baskı provası — ${p.id}`
              )}&body=${encodeURIComponent(
                `Merhaba ${p.address?.name ?? ""},\n\nSiparişinizin baskı provası hazır. Onaylamak için:\n${proofUrl}\n\nTeşekkürler,\nPim Etiket`
              )}`}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg ring-1 ring-gri-200 bg-white text-[12.5px] font-semibold text-lacivert hover:ring-lacivert"
            >
              E-posta
            </a>
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
                label: "Bekleyen",
                count: kpiDisplay.pending,
                accent: "text-sari-koyu",
                bg: "bg-sari-soft",
              },
              {
                label: "Bugün onaylanan",
                count: kpiDisplay.approvedToday,
                accent: "text-yesil",
                bg: "bg-yesil-soft",
              },
              {
                label: "Ort. yanıt süresi",
                count: kpiDisplay.avgResponseHours,
                accent: "text-lacivert",
                bg: "bg-gri-100",
                suffix: " sa",
                isHours: true,
              },
              {
                label: "SLA aşılan",
                count: kpiDisplay.slaBreached,
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
                    {"isHours" in k && k.isHours
                      ? k.count > 0
                        ? k.count.toFixed(1)
                        : "—"
                      : k.count}
                    {"suffix" in k && k.suffix && k.count > 0 ? k.suffix : ""}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filter === "approved" && approvedOrders.length > 0 && (
          <div className="mb-4 rounded-lg bg-yesil-soft/30 ring-1 ring-yesil/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-yesil-koyu font-medium">
               {approvedOrders.length} sipariş müşteri tarafından onaylandı —
              üretime alınabilir
            </span>
            <Button
              variant="primary"
              size="sm"
              className="!bg-yesil hover:!bg-yesil-koyu"
              onClick={() => void bulkApprove()}
              disabled={bulkLoading || !hasContractedPartner}
              title={
                !hasContractedPartner
                  ? "Sozlesmeli partner yok — once partner sozlesmesi tamamlanmali"
                  : undefined
              }
            >
              Üretime taşı ({approvedOrders.length})
            </Button>
          </div>
        )}

        <div className="flex gap-2 mb-5 flex-wrap">
          {(
            [
              { id: "pending" as const, label: "Bekliyor" },
              { id: "validating" as const, label: "Validating" },
              { id: "generating" as const, label: "Hazırlanıyor" },
              { id: "approved" as const, label: "Onaylı" },
              { id: "rejected" as const, label: "Reddedildi" },
              { id: "sla_breached" as const, label: "SLA Aşıldı" },
              { id: "all" as const, label: "Tümü" },
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
              {f.label} ({counts[f.id]})
            </button>
          ))}
        </div>

        {sortedItems.length === 0 ? (
          <Card padding="p-10" className="text-center">
            <Pim pose="happy" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {items.length === 0 && filter !== "rejected"
                ? "Prova kuyruğu temiz "
                : "Bu filtrede sipariş yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {items.length === 0 && filter !== "rejected"
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
                <Card
                  key={p.id}
                  id={`prova-order-${p.id}`}
                  padding="p-5"
                  className={cn(
                    deepLinkOrder === p.id &&
                      "ring-2 ring-pim-mercan shadow-md"
                  )}
                >
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
                        <ProofSlaTag
                          createdAt={p.createdAt}
                          status={p.status}
                          autoRefundHealthy={autoRefundHealthy}
                        />
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
                      <CutlineReadinessBadge readiness={readinessMap[p.id]} />

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

