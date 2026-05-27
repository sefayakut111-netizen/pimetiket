"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getAdminPillClasses,
  getAssignmentStatusLabel,
  type AssignmentStatus,
} from "@/lib/fason/status-labels";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  CAPABILITY_LABEL,
  formatShortDate,
  isAssignmentOverdue,
  type AssignmentRow,
  type FasonPartner,
  type JobsFilter,
  type PartnerDetailTab,
} from "@/components/admin/fason/fason-types";

export function PartnerAssignmentsPanel({
  partner,
  history,
  filteredJobs,
  jobStats,
  jobsFilter,
  onJobsFilterChange,
  loading,
  onAssigned,
}: {
  partner: FasonPartner;
  history: AssignmentRow[];
  filteredJobs: AssignmentRow[];
  jobStats: {
    active: number;
    overdue: number;
    completed: number;
    issues: number;
  };
  jobsFilter: JobsFilter;
  onJobsFilterChange: (f: JobsFilter) => void;
  loading: boolean;
  onAssigned: () => void;
}) {
  const filterChips: Array<{ id: JobsFilter; label: string; count?: number }> =
    [
      { id: "active", label: "Aktif", count: jobStats.active },
      { id: "all", label: "Tümü", count: history.length },
      { id: "completed", label: "Tamamlanan", count: jobStats.completed },
      { id: "issue", label: "Sorunlu", count: jobStats.issues },
    ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg bg-pim-mercan-tint ring-1 ring-pim-mercan/20 p-2.5">
          <div className="text-[10px] font-bold uppercase text-gri-600">
            Aktif iş
          </div>
          <div className="text-[18px] font-bold text-lacivert tabular-nums">
            {jobStats.active}
          </div>
        </div>
        <div
          className={cn(
            "rounded-lg p-2.5 ring-1",
            jobStats.overdue > 0
              ? "bg-kirmizi-soft ring-kirmizi/30"
              : "bg-gri-50 ring-gri-200"
          )}
        >
          <div className="text-[10px] font-bold uppercase text-gri-600">
            Geciken
          </div>
          <div
            className={cn(
              "text-[18px] font-bold tabular-nums",
              jobStats.overdue > 0 ? "text-kirmizi" : "text-lacivert"
            )}
          >
            {jobStats.overdue}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onJobsFilterChange(chip.id)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
              jobsFilter === chip.id
                ? "bg-lacivert text-white"
                : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-lacivert"
            )}
          >
            {chip.label}
            {chip.count != null && (
              <span
                className={cn(
                  "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
                  jobsFilter === chip.id
                    ? "bg-white/20"
                    : "bg-gri-100 text-gri-600"
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && history.length === 0 && (
        <div className="rounded-xl border border-dashed border-gri-200 bg-gri-50/50 p-6 text-center">
          <div className="text-[13px] font-semibold text-gri-700 mb-1">
            Henüz atanan iş yok
          </div>
          <p className="text-[12px] text-gri-500 mb-4">
            Bu partnere sipariş atandığında burada durum takibi yapılır.
          </p>
          <AssignOrderToPartner
            partnerId={partner.id}
            partnerName={partner.name}
            onAssigned={onAssigned}
            alwaysShow
          />
        </div>
      )}

      {!loading && history.length > 0 && filteredJobs.length === 0 && (
        <p className="text-[13px] text-gri-700 py-4 text-center">
          Bu filtrede kayıt yok.
        </p>
      )}

      {!loading && filteredJobs.length > 0 && (
        <ul className="space-y-2 max-h-[min(520px,60vh)] overflow-y-auto pr-0.5">
          {filteredJobs.map((a) => {
            const meta = getAdminPillClasses(a.status as AssignmentStatus);
            const statusMeta = getAssignmentStatusLabel(
              a.status as AssignmentStatus,
              "admin"
            );
            const overdue = isAssignmentOverdue(a);
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  overdue
                    ? "border-kirmizi/40 bg-kirmizi-soft/30"
                    : a.status === "issue"
                      ? "border-sari/50 bg-sari-soft/40"
                      : "border-gri-200 bg-white hover:border-pim-mercan/40"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/siparisler/${a.order_id}`}
                      className="font-mono text-[12px] font-semibold text-pim-mercan hover:underline"
                    >
                      {a.order_id}
                    </Link>
                    <div className="text-[12px] text-gri-700 truncate mt-0.5">
                      {a.customer_name ?? "—"}
                      {a.order_total != null && (
                        <span className="text-gri-500 ml-1.5 tabular-nums">
                          · ₺{a.order_total.toLocaleString("tr-TR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center h-[22px] px-2.5 rounded-full text-[10.5px] font-semibold shrink-0",
                      meta.className
                    )}
                  >
                    {meta.label}
                  </span>
                </div>

                {statusMeta.hint && (
                  <p className="text-[11px] text-gri-600 mb-2 leading-snug">
                    {statusMeta.hint}
                  </p>
                )}

                {a.status === "issue" && a.issue_description && (
                  <p className="text-[11px] text-kirmizi-koyu mb-2 leading-snug">
                    {a.issue_description}
                  </p>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gri-600">
                  <span>
                    Atama:{" "}
                    <strong className="text-gri-800">
                      {formatShortDate(a.assigned_at)}
                    </strong>
                  </span>
                  <span>
                    Hedef:{" "}
                    <strong
                      className={cn(
                        overdue ? "text-kirmizi" : "text-gri-800"
                      )}
                    >
                      {formatShortDate(a.estimated_delivery)}
                      {overdue && " · gecikti"}
                    </strong>
                  </span>
                  {a.shipped_at && (
                    <span>
                      Gönderim:{" "}
                      <strong className="text-gri-800">
                        {formatShortDate(a.shipped_at)}
                      </strong>
                    </span>
                  )}
                </div>

                {a.tracking_number && (
                  <div className="mt-2 text-[11px]">
                    {" "}
                    {a.tracking_url ? (
                      <a
                        href={a.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pim-mercan font-semibold hover:underline"
                      >
                        {a.tracking_company ?? "Kargo"} · {a.tracking_number}
                      </a>
                    ) : (
                      <span className="text-gri-700">
                        {a.tracking_company ?? "Kargo"} · {a.tracking_number}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gri-100">
          <AssignOrderToPartner
            partnerId={partner.id}
            partnerName={partner.name}
            onAssigned={onAssigned}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// PartnerCapabilitiesPanel
// ============================================================

export function PartnerCapabilitiesPanel({
  partner,
  onUpdated,
}: {
  partner: FasonPartner;
  onUpdated: (p: FasonPartner) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const caps = partner.capabilities ?? [];

  if (caps.length === 0) return null;

  const verify = async (capabilityId: string, verified: boolean) => {
    setBusyId(capabilityId);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${partner.id}/capabilities/verify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ capabilityId, verified }),
        }
      );
      if (!res.ok) return;
      const nextCaps = caps.map((c) =>
        c.id === capabilityId ? { ...c, is_verified: verified } : c
      );
      onUpdated({ ...partner, capabilities: nextCaps });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-4 pb-4 border-b border-gri-100">
      <h4 className="text-[12px] font-bold uppercase text-gri-500 mb-2">
        Yetkinlik onayı
      </h4>
      <ul className="space-y-2">
        {caps.map((c) => {
          const label =
            CAPABILITY_LABEL[c.capability_value] ?? c.capability_value;
          const verified = c.is_verified !== false;
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 text-[12px]"
            >
              <span>
                {c.capability_type === "product_type" ? "Ürün" : "Malzeme"}:{" "}
                <strong>{label}</strong>
              </span>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-yesil font-semibold">
                   Onaylı
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId === c.id}
                  onClick={() => void verify(c.id, true)}
                >
                  Onayla
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// PartnerActions
// ============================================================

export function PartnerActions({
  partner,
  onUpdated,
}: {
  partner: FasonPartner;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const action = async (endpoint: string, reason: string) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${partner.id}/${endpoint}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      if (res.ok) onUpdated();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const confirmAction = (endpoint: string, confirmMsg: string, reason: string) => {
    if (!confirm(confirmMsg)) return;
    void action(endpoint, reason);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-8 h-8 rounded-lg hover:bg-gri-100 flex items-center justify-center text-gri-600"
        title="İşlemler"
      >
        <Icon.Menu size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-20 w-48 rounded-lg bg-white shadow-lg ring-1 ring-gri-200 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {partner.status !== "paused" && partner.active && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-sari-koyu"
              onClick={() =>
                confirmAction(
                  "pause",
                  `${partner.name} duraklatılsın mı? Yeni atama almaz.`,
                  "Admin panelinden duraklatıldı"
                )
              }
              disabled={busy}
            >
              ◐ Duraklat
            </button>
          )}
          {(partner.status === "paused" || !partner.active) &&
            partner.status !== "terminated" && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-yesil"
                onClick={() =>
                  confirmAction(
                    "resume",
                    `${partner.name} tekrar aktif edilsin mi?`,
                    "Admin panelinden devam ettirildi"
                  )
                }
                disabled={busy}
              >
                ▶ Devam ettir
              </button>
            )}
          {partner.status !== "terminated" && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-kirmizi"
              onClick={() =>
                confirmAction(
                  "terminate",
                  `${partner.name} kalıcı olarak sonlandırılsın mı? Bu işlem geri alınamaz.`,
                  "Admin panelinden sonlandırıldı"
                )
              }
              disabled={busy}
            >
               Sonlandır
            </button>
          )}
          <div className="border-t border-gri-100 my-1" />
          <Link
            href={`/admin/fason/yeni?edit=${partner.id}`}
            className="block px-3 py-2 text-[13px] hover:bg-gri-50 text-lacivert"
            onClick={() => setOpen(false)}
          >
             Düzenle
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PartnerScoreBreakdown
// ============================================================

export function PartnerScoreBreakdown({
  history,
}: {
  partner: FasonPartner;
  history: AssignmentRow[];
}) {
  const metrics = useMemo(() => {
    if (history.length === 0) return null;

    const completed = history.filter(
      (a) => a.status === "completed" || a.actual_delivery
    );
    const total = history.length;

    const onTime = completed.filter((a) => {
      if (!a.estimated_delivery || !a.actual_delivery) return false;
      return (
        new Date(a.actual_delivery).getTime() <=
        new Date(a.estimated_delivery).getTime()
      );
    }).length;
    const onTimeRate =
      completed.length > 0
        ? Math.round((onTime / completed.length) * 100)
        : null;

    const rejected = history.filter(
      (a) => a.status === "rejected" || a.status === "cancelled"
    ).length;
    const rejectRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

    const deliveryDays = completed
      .filter((a) => a.assigned_at && a.actual_delivery)
      .map(
        (a) =>
          (new Date(a.actual_delivery!).getTime() -
            new Date(a.assigned_at!).getTime()) /
          86400000
      );
    const avgDays =
      deliveryDays.length > 0
        ? deliveryDays.reduce((s, d) => s + d, 0) / deliveryDays.length
        : null;

    return {
      onTimeRate,
      rejectRate,
      avgDays,
      totalOrders: total,
      completedOrders: completed.length,
    };
  }, [history]);

  if (!metrics) return null;

  return (
    <div className="mb-4 pb-4 border-b border-gri-100">
      <h4 className="text-[12px] font-bold uppercase text-gri-500 mb-3">
        Performans kırılımı
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Zamanında teslim</div>
          <div
            className={cn(
              "text-[16px] font-bold",
              metrics.onTimeRate === null
                ? "text-gri-400"
                : metrics.onTimeRate >= 80
                  ? "text-yesil"
                  : "text-kirmizi"
            )}
          >
            {metrics.onTimeRate !== null ? `%${metrics.onTimeRate}` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Red oranı</div>
          <div
            className={cn(
              "text-[16px] font-bold",
              metrics.rejectRate <= 5 ? "text-yesil" : "text-kirmizi"
            )}
          >
            %{metrics.rejectRate}
          </div>
        </div>
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Ort. teslim</div>
          <div className="text-[16px] font-bold text-lacivert">
            {metrics.avgDays !== null
              ? `${metrics.avgDays.toFixed(1)} gün`
              : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Toplam iş</div>
          <div className="text-[16px] font-bold text-lacivert">
            {metrics.totalOrders}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PartnerMailLog
// ============================================================

export function PartnerMailLog({ partnerId }: { partnerId: string }) {
  const [mails, setMails] = useState<
    Array<{ template: string; sentAt: string; status: string }>
  >([]);

  useEffect(() => {
    fetch(`/api/admin/fason/partners/${partnerId}/mail-log?limit=10`)
      .then((r) => r.json())
      .then((d) => setMails(d.mails ?? []))
      .catch(() => {});
  }, [partnerId]);

  if (mails.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gri-100">
      <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">
        Son iletişim
      </h4>
      <ul className="space-y-1">
        {mails.map((m, i) => (
          <li
            key={i}
            className="text-[11px] text-gri-600 flex justify-between gap-2"
          >
            <span> {m.template.replace(/_/g, " ")}</span>
            <span className="text-gri-400 shrink-0">
              {new Date(m.sentAt).toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// AssignOrderToPartner
// ============================================================

export function AssignOrderToPartner({
  partnerId,
  partnerName,
  onAssigned,
  alwaysShow = false,
}: {
  partnerId: string;
  partnerName: string;
  onAssigned: () => void;
  alwaysShow?: boolean;
}) {
  const [unassigned, setUnassigned] = useState<
    Array<{ id: string; customer: string; total: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadUnassigned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/admin/orders/list?status=ready_to_ship,proof_approved&limit=20"
      );
      const data = (await res.json()) as {
        orders?: Array<{
          id: string;
          total: number;
          fasonName?: string;
          address?: { name?: string } | null;
        }>;
      };
      setUnassigned(
        (data.orders ?? [])
          .filter((o) => !o.fasonName)
          .map((o) => ({
            id: o.id,
            customer: o.address?.name ?? "—",
            total: o.total,
          }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnassigned();
  }, [loadUnassigned]);

  const assignOrder = async (orderId: string) => {
    if (!confirm(`${orderId} → ${partnerName} atasın mı?`)) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/fason/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, fasonPartnerId: partnerId }),
      });
      if (res.ok) {
        setUnassigned((prev) => prev.filter((o) => o.id !== orderId));
        onAssigned();
      }
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return alwaysShow ? (
      <p className="text-[12px] text-gri-500">Atanabilir siparişler yükleniyor…</p>
    ) : null;
  }

  if (unassigned.length === 0) {
    return alwaysShow ? (
      <p className="text-[12px] text-gri-500">
        Şu an atanabilecek hazır sipariş yok.
      </p>
    ) : null;
  }

  return (
    <div className={cn(!alwaysShow && "mt-4 pt-4 border-t border-gri-100")}>
      <h4 className="text-[12px] font-bold uppercase text-gri-500 mb-2">
        Atanabilecek siparişler ({unassigned.length})
      </h4>
      <ul className="space-y-1.5">
        {unassigned.slice(0, 5).map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between text-[12px] gap-2"
          >
            <span className="font-mono text-[11px] truncate">
              {o.id} · {o.customer}
            </span>
            <button
              type="button"
              onClick={() => void assignOrder(o.id)}
              disabled={assigning}
              className="text-pim-mercan font-semibold hover:underline text-[11px] shrink-0"
            >
              Ata →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PartnerDetailView({
  partner,
  onPartnerUpdated,
}: {
  partner: FasonPartner;
  onPartnerUpdated: (p: FasonPartner) => void;
}) {
  const [history, setHistory] = useState<AssignmentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tab, setTab] = useState<PartnerDetailTab>("jobs");
  const [jobsFilter, setJobsFilter] = useState<JobsFilter>("active");

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/admin/fason/assignments?partnerId=${encodeURIComponent(partner.id)}`
      );
      const json = (await res.json()) as { assignments?: AssignmentRow[] };
      setHistory(json.assignments ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [partner.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filteredJobs = useMemo(() => {
    switch (jobsFilter) {
      case "active":
        return history.filter((a) => ACTIVE_ASSIGNMENT_STATUSES.has(a.status));
      case "completed":
        return history.filter((a) => a.status === "shipped");
      case "issue":
        return history.filter((a) => a.status === "issue");
      default:
        return history;
    }
  }, [history, jobsFilter]);

  const jobStats = useMemo(() => {
    const now = Date.now();
    const active = history.filter((a) =>
      ACTIVE_ASSIGNMENT_STATUSES.has(a.status)
    );
    const overdue = active.filter(
      (a) =>
        a.estimated_delivery &&
        new Date(a.estimated_delivery).getTime() < now
    );
    return {
      active: active.length,
      overdue: overdue.length,
      completed: history.filter((a) => a.status === "shipped").length,
      issues: history.filter((a) => a.status === "issue").length,
    };
  }, [history]);

  const completedHistory = useMemo(
    () =>
      history.filter((a) => a.status === "shipped" || a.actual_delivery),
    [history]
  );

  const tabs: Array<{ id: PartnerDetailTab; label: string }> = [
    { id: "jobs", label: "Atanan işler" },
    { id: "partner", label: "Partner detayı" },
    { id: "history", label: "Geçmiş işler" },
  ];

  return (
    <Card padding="p-6">
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-gri-50 rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 min-w-[120px] h-10 rounded-md text-[13px] font-semibold transition-colors",
              tab === t.id
                ? "bg-white text-lacivert shadow-sm ring-1 ring-gri-200"
                : "text-gri-600 hover:text-lacivert"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "jobs" && (
        <PartnerAssignmentsPanel
          partner={partner}
          history={history}
          filteredJobs={filteredJobs}
          jobStats={jobStats}
          jobsFilter={jobsFilter}
          onJobsFilterChange={setJobsFilter}
          loading={historyLoading}
          onAssigned={() => void loadHistory()}
        />
      )}

      {tab === "partner" && (
        <>
          <PartnerCapabilitiesPanel
            partner={partner}
            onUpdated={onPartnerUpdated}
          />
          <PartnerScoreBreakdown partner={partner} history={history} />
          <div className="space-y-1.5 text-[13px] text-gri-700">
            <div>
              Tipik teslim:{" "}
              <strong>{partner.default_lead_days} gün</strong>
            </div>
            {partner.express_lead_time_days != null && (
              <div>
                Express:{" "}
                <strong>{partner.express_lead_time_days} gün</strong>
              </div>
            )}
            {partner.min_order_amount_try != null && (
              <div>
                Min. sipariş:{" "}
                <strong>
                  {partner.min_order_amount_try.toLocaleString("tr-TR")} TL
                </strong>
              </div>
            )}
            <div>
              <a
                href={`mailto:${partner.contact_email}`}
                className="text-pim-mercan hover:underline"
              >
                {partner.contact_email}
              </a>
            </div>
            {partner.contact_whatsapp && <div>{partner.contact_whatsapp}</div>}
            {partner.contact_person && <div>{partner.contact_person}</div>}
            <div className="pt-3 border-t border-gri-100 mt-3">
              Sözleşme:{" "}
              {partner.contract_signed_at ? (
                <>
                  <span className="text-yesil font-semibold">
                    İmzalı (
                    {new Date(partner.contract_signed_at).toLocaleDateString(
                      "tr-TR"
                    )}
                    )
                  </span>
                  {partner.contract_pdf_url && (
                    <a
                      href={partner.contract_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-pim-mercan font-semibold hover:underline text-[12px]"
                    >
                      PDF indir
                    </a>
                  )}
                </>
              ) : (
                <span className="text-kirmizi font-semibold">İmzasız</span>
              )}
            </div>
            <PartnerMailLog partnerId={partner.id} />
          </div>
        </>
      )}

      {tab === "history" && (
        <>
          <PartnerScoreBreakdown partner={partner} history={history} />
          {completedHistory.length === 0 ? (
            <p className="text-[13px] text-gri-700 py-4">
              Tamamlanan iş kaydı yok.
            </p>
          ) : (
            <ul className="space-y-2 mt-4">
              {completedHistory.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-gri-200 p-3 text-[12px]"
                >
                  <Link
                    href={`/admin/siparisler/${a.order_id}`}
                    className="font-mono font-semibold text-pim-mercan hover:underline"
                  >
                    {a.order_id}
                  </Link>
                  <div className="text-gri-600 mt-1">
                    {a.customer_name ?? "—"} · Teslim:{" "}
                    {formatShortDate(a.shipped_at ?? a.actual_delivery)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
