"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button, Card, Modal, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getAdminPillClasses,
  getAssignmentStatusLabel,
  type AssignmentStatus,
} from "@/lib/fason/status-labels";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  formatShortDate,
  isAssignmentOverdue,
  type AssignmentRow,
  type FasonPartner,
  type JobsFilter,
  type PartnerDetailTab,
} from "@/components/admin/fason/fason-types";
import { PartnerCapacityPanel } from "@/components/admin/fason/partner-capacity-panel";
import { excludeTestOrderLikes } from "@/lib/admin-order-filters";

function metricValueClass(value: number): string {
  return value === 0 ? "text-gri-400" : "text-lacivert font-semibold";
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="text-gri-400">
        — <span className="text-[11px] font-normal">(ilk 5 is tamamlaninca)</span>
      </span>
    );
  }
  const pct = Math.round(score * 100);
  const filled = Math.max(1, Math.round(pct / 20));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold text-lacivert tabular-nums">{pct}/100</span>
      <span className="inline-flex items-center gap-0.5 text-sari-koyu">
        {Array.from({ length: 5 }).map((_, i) => (
          <Icon.Star
            key={i}
            size={12}
            className={cn(i < filled ? "opacity-100" : "opacity-25")}
          />
        ))}
      </span>
    </span>
  );
}

function PartnerSidebar({
  partner,
  jobStats,
  onPartnerUpdated,
}: {
  partner: FasonPartner;
  jobStats: {
    active: number;
    overdue: number;
    completed: number;
    issues: number;
  };
  onPartnerUpdated: (p: FasonPartner) => void;
}) {
  return (
    <aside className="space-y-0 rounded-xl border border-gri-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
      <section className="pb-4">
        <h3 className="text-[11px] font-bold uppercase text-gri-500 mb-3">
          Performans
        </h3>
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-gri-600">Aktif is:</dt>
            <dd className={metricValueClass(jobStats.active)}>{jobStats.active}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gri-600">Geciken:</dt>
            <dd className={metricValueClass(jobStats.overdue)}>{jobStats.overdue}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gri-600">Tamamlanan:</dt>
            <dd className={metricValueClass(jobStats.completed)}>
              {jobStats.completed}
            </dd>
          </div>
          <div className="flex justify-between gap-3 items-start">
            <dt className="text-gri-600 shrink-0">Ortalama skor:</dt>
            <dd className="text-right">
              <ScoreDisplay score={partner.cached_score} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gri-600">Tipik teslim:</dt>
            <dd className="text-lacivert font-semibold">
              {partner.default_lead_days} gun
            </dd>
          </div>
        </dl>
      </section>

      <section className="py-4 border-t border-gri-100">
        <h3 className="text-[11px] font-bold uppercase text-gri-500 mb-3">
          Firma bilgileri
        </h3>
        <dl className="space-y-2 text-[13px]">
          <div>
            <dt className="text-gri-500 text-[11px]">Ad</dt>
            <dd className="font-medium text-lacivert">{partner.name}</dd>
          </div>
          {partner.city && (
            <div>
              <dt className="text-gri-500 text-[11px]">Sehir</dt>
              <dd>{partner.city}</dd>
            </div>
          )}
          <div>
            <dt className="text-gri-500 text-[11px]">E-posta</dt>
            <dd>
              <a
                href={`mailto:${partner.contact_email}`}
                className="text-pim-mercan hover:underline break-all"
              >
                {partner.contact_email}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <PartnerCapacityPanel partner={partner} onUpdated={onPartnerUpdated} />
    </aside>
  );
}

function formatOrderLineSummary(
  items: Array<{ product: string; title?: string; qty: number }>
): string {
  const first = items[0];
  if (!first) return "";
  const label =
    first.title?.trim() ||
    (first.product === "sticker" ? "Sticker" : "Etiket");
  return `${label} x ${first.qty.toLocaleString("tr-TR")}`;
}

function partnerCanReceiveAssignments(partner: FasonPartner): boolean {
  return !!(
    partner.contract_signed_at ||
    (partner.contract_pdf_url && partner.contract_pdf_url.trim().length > 0)
  );
}

function defaultEstimatedDeliveryIso(leadDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, leadDays));
  return d.toISOString().slice(0, 10);
}

function AssignOrderToPartner({
  partner,
  onAssigned,
}: {
  partner: FasonPartner;
  onAssigned: () => void;
}) {
  const toast = useToast();
  const contractSigned = partnerCanReceiveAssignments(partner);
  const [unassigned, setUnassigned] = useState<
    Array<{
      id: string;
      customer: string;
      total: number;
      summary: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<{
    id: string;
    customer: string;
    summary: string;
    total: number;
  } | null>(null);

  const loadUnassigned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/admin/orders/list?status=ready_to_ship,proof_approved&limit=20"
      );
      if (!res.ok) {
        toast.error("Atanabilir siparisler yuklenemedi");
        return;
      }
      const data = (await res.json()) as {
        orders?: Array<{
          id: string;
          total: number;
          fasonName?: string;
          address?: { name?: string } | null;
          items?: Array<{ product: string; title?: string; qty: number }>;
        }>;
      };
      setUnassigned(
        excludeTestOrderLikes(data.orders ?? [])
          .filter((o) => !o.fasonName)
          .map((o) => ({
            id: o.id,
            customer: o.address?.name ?? "—",
            total: o.total,
            summary: formatOrderLineSummary(o.items ?? []),
          }))
      );
    } catch {
      toast.error("Atanabilir siparisler yuklenemedi (ag hatasi)");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadUnassigned();
  }, [loadUnassigned]);

  const requestAssign = (order: {
    id: string;
    customer: string;
    summary: string;
    total: number;
  }) => {
    if (!contractSigned) {
      toast.error("Sozlesme imzalanmadan atama yapilamaz");
      return;
    }
    setConfirmOrder(order);
  };

  const executeAssign = async () => {
    if (!confirmOrder) return;
    const orderId = confirmOrder.id;
    setAssigningOrderId(orderId);
    try {
      const res = await fetch("/api/admin/fason/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          fasonPartnerId: partner.id,
          estimatedDelivery: defaultEstimatedDeliveryIso(
            partner.default_lead_days
          ),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        fasonName?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Atama basarisiz");
        return;
      }
      setUnassigned((prev) => prev.filter((o) => o.id !== orderId));
      setConfirmOrder(null);
      toast.success(
        `${orderId} siparisi ${json.fasonName ?? partner.name} partnere atandi`
      );
      onAssigned();
    } catch {
      toast.error("Atama basarisiz (ag hatasi)");
    } finally {
      setAssigningOrderId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-[12px] text-gri-500 mt-6">
        Atanabilir siparisler yukleniyor...
      </p>
    );
  }

  if (unassigned.length === 0) {
    return (
      <p className="text-[12px] text-gri-500 mt-6">
        Su an atanabilecek hazir siparis yok.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 pt-4 border-t border-gri-100">
        <h4 className="text-[12px] font-bold uppercase text-gri-500 mb-3">
          Atanabilecek siparisler ({unassigned.length})
        </h4>
        <ul className="space-y-2">
          {unassigned.slice(0, 8).map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gri-200 bg-gri-50/50 px-3 py-2.5"
            >
              <div className="min-w-0 text-[12px]">
                <span className="font-mono font-semibold text-lacivert">
                  {o.id}
                </span>
                <span className="text-gri-700"> · {o.customer}</span>
                {o.summary && (
                  <span className="text-gri-500"> · {o.summary}</span>
                )}
                <span className="text-gri-600 tabular-nums">
                  {" "}
                  · {o.total.toLocaleString("tr-TR")} TL
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={assigningOrderId !== null}
                onClick={() => requestAssign(o)}
                className="shrink-0"
              >
                {assigningOrderId === o.id ? "Ataniyor..." : "Ata"}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <Modal
        open={confirmOrder != null}
        onClose={() => {
          if (assigningOrderId) return;
          setConfirmOrder(null);
        }}
        title="Siparis atama onayi"
        maxWidthClassName="max-w-[480px]"
      >
        {confirmOrder && (
          <div className="space-y-4">
            <p className="text-[14px] text-gri-700 leading-relaxed">
              <strong className="font-mono text-lacivert">
                {confirmOrder.id}
              </strong>{" "}
              siparisini{" "}
              <strong className="text-lacivert">{partner.name}</strong>{" "}
              partnere atamak istediginizden emin misiniz?
            </p>
            <p className="text-[12px] text-gri-600">
              {confirmOrder.customer}
              {confirmOrder.summary ? ` · ${confirmOrder.summary}` : ""} ·{" "}
              {confirmOrder.total.toLocaleString("tr-TR")} TL
            </p>
            <p className="text-[12px] text-gri-500">
              Hedef teslim:{" "}
              {defaultEstimatedDeliveryIso(partner.default_lead_days)} (
              {partner.default_lead_days} gun)
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={assigningOrderId !== null}
                onClick={() => setConfirmOrder(null)}
              >
                Vazgec
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={assigningOrderId !== null}
                onClick={() => void executeAssign()}
              >
                {assigningOrderId ? "Ataniyor..." : "Ata"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function JobsTabContent({
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
      { id: "all", label: "Tumu", count: history.length },
      { id: "completed", label: "Tamamlanan", count: jobStats.completed },
      { id: "issue", label: "Sorunlu", count: jobStats.issues },
    ];

  return (
    <div>
      <h2 className="text-[13px] font-bold uppercase text-gri-500 mb-3">
        Atanan isler
      </h2>

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
        <p className="text-sm text-gri-500 mb-2">
          Henuz atanan is yok. Asagidaki siparisleri bu partnere atayabilirsin.
        </p>
      )}

      {!loading && history.length > 0 && filteredJobs.length === 0 && (
        <p className="text-[13px] text-gri-700 py-4">
          Bu filtrede kayit yok.
        </p>
      )}

      {!loading && filteredJobs.length > 0 && (
        <ul className="space-y-2 mb-2">
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
                          · {a.order_total.toLocaleString("tr-TR")} TL
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AssignOrderToPartner partner={partner} onAssigned={onAssigned} />
    </div>
  );
}

function PartnerExtendedTab({ partner }: { partner: FasonPartner }) {
  return (
    <div className="space-y-5 text-[13px] text-gri-700">
      <h2 className="text-[13px] font-bold uppercase text-gri-500">
        Partner detayi
      </h2>
      <dl className="space-y-3">
        {partner.contact_person && (
          <div>
            <dt className="text-gri-500 text-[11px]">Yetkili kisi</dt>
            <dd>{partner.contact_person}</dd>
          </div>
        )}
        {partner.contact_whatsapp && (
          <div>
            <dt className="text-gri-500 text-[11px]">WhatsApp</dt>
            <dd>{partner.contact_whatsapp}</dd>
          </div>
        )}
        {partner.express_lead_time_days != null && (
          <div>
            <dt className="text-gri-500 text-[11px]">Express teslim</dt>
            <dd>{partner.express_lead_time_days} gun</dd>
          </div>
        )}
        {partner.min_order_amount_try != null && (
          <div>
            <dt className="text-gri-500 text-[11px]">Min. siparis</dt>
            <dd>
              {partner.min_order_amount_try.toLocaleString("tr-TR")} TL
            </dd>
          </div>
        )}
        {partner.payment_term && (
          <div>
            <dt className="text-gri-500 text-[11px]">Odeme vadesi</dt>
            <dd>{partner.payment_term}</dd>
          </div>
        )}
        {partner.notes && (
          <div>
            <dt className="text-gri-500 text-[11px]">Notlar</dt>
            <dd className="whitespace-pre-wrap">{partner.notes}</dd>
          </div>
        )}
      </dl>
      <PartnerMailLog partnerId={partner.id} />
    </div>
  );
}

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
        title="Islemler"
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
                  `${partner.name} duraklatilsin mi? Yeni atama almaz.`,
                  "Admin panelinden duraklatildi"
                )
              }
              disabled={busy}
            >
              Duraklat
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
                Devam ettir
              </button>
            )}
          {partner.status !== "terminated" && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-kirmizi"
              onClick={() =>
                confirmAction(
                  "terminate",
                  `${partner.name} kalici olarak sonlandirilsin mi? Bu islem geri alinamaz.`,
                  "Admin panelinden sonlandirildi"
                )
              }
              disabled={busy}
            >
              Sonlandir
            </button>
          )}
          <div className="border-t border-gri-100 my-1" />
          <Link
            href={`/admin/fason/yeni?edit=${partner.id}`}
            className="block px-3 py-2 text-[13px] hover:bg-gri-50 text-lacivert"
            onClick={() => setOpen(false)}
          >
            Duzenle
          </Link>
        </div>
      )}
    </div>
  );
}

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
    <div className="pt-3 border-t border-gri-100">
      <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">
        Son iletisim
      </h4>
      <ul className="space-y-1">
        {mails.map((m, i) => (
          <li
            key={i}
            className="text-[11px] text-gri-600 flex justify-between gap-2"
          >
            <span>{m.template.replace(/_/g, " ")}</span>
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
    { id: "jobs", label: "Atanan isler" },
    { id: "partner", label: "Partner detayi" },
    { id: "history", label: "Gecmis isler" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] gap-5 items-start">
      <Card padding="p-5" className="min-w-0">
        <div className="flex flex-wrap gap-1 mb-5 p-1 bg-gri-50 rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 min-w-[100px] h-9 rounded-md text-[12.5px] font-semibold transition-colors",
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
          <JobsTabContent
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

        {tab === "partner" && <PartnerExtendedTab partner={partner} />}

        {tab === "history" && (
          <div>
            <h2 className="text-[13px] font-bold uppercase text-gri-500 mb-4">
              Gecmis isler
            </h2>
            {completedHistory.length === 0 ? (
              <p className="text-[13px] text-gri-700 py-4">
                Henuz tamamlanan is yok. Ilk siparis atandiginda burada gorunur.
              </p>
            ) : (
              <ul className="space-y-2">
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
                      {a.order_total != null && (
                        <span className="tabular-nums">
                          {" "}
                          · {a.order_total.toLocaleString("tr-TR")} TL
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <PartnerSidebar
        partner={partner}
        jobStats={jobStats}
        onPartnerUpdated={onPartnerUpdated}
      />
    </div>
  );
}
