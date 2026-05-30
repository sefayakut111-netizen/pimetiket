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
  COMMUNICATION_CHANNEL_LABEL,
  DEFAULT_MAX_CONCURRENT_ORDERS,
  formatShortDate,
  isAssignmentOverdue,
  type AssignmentRow,
  type FasonPartner,
  type JobsFilter,
  type PartnerCommunication,
  type PartnerCommunicationChannel,
  type PartnerDetailTab,
  type FasonFileTransfer,
  FILE_TRANSFER_TYPE_LABEL,
} from "@/components/admin/fason/fason-types";
import { PartnerCapacityPanel } from "@/components/admin/fason/partner-capacity-panel";
import { ContractDownloadButton } from "@/components/admin/fason/contract-download-button";
import { PerformanceScoreModal } from "@/components/admin/fason/performance-score-modal";
import { PerformanceSummaryCard } from "@/components/admin/fason/performance-summary-card";
import { excludeTestOrderLikes } from "@/lib/admin-order-filters";
import {
  FASON_MATERIAL_LABELS,
  FASON_PRODUCT_LABELS,
  mapOrderItemToCapability,
  partnerHasApprovedCapability,
} from "@/components/admin/fason/fason-capabilities";

const HISTORY_PAGE_SIZE = 10;

function PartnerSidebar({
  partner,
  onPartnerUpdated,
}: {
  partner: FasonPartner;
  onPartnerUpdated: (p: FasonPartner) => void;
}) {
  const [perfOpen, setPerfOpen] = useState(false);
  const hasContractPdf = !!(
    partner.contract_pdf_url && partner.contract_pdf_url.trim().length > 0
  );

  return (
    <>
      <aside className="space-y-0 rounded-xl border border-gri-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
        <PerformanceSummaryCard
          partnerId={partner.id}
          partnerName={partner.name}
          defaultLeadDays={partner.default_lead_days}
          cachedScore={partner.cached_score}
          onOpenDetail={() => setPerfOpen(true)}
        />

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
            {hasContractPdf && (
              <div className="pt-1">
                <ContractDownloadButton
                  partnerId={partner.id}
                  hasContract={hasContractPdf}
                  size="sm"
                />
              </div>
            )}
          </dl>
        </section>

        <PartnerCapacityPanel partner={partner} onUpdated={onPartnerUpdated} />
      </aside>

      <PerformanceScoreModal
        partnerId={partner.id}
        partnerName={partner.name}
        open={perfOpen}
        onClose={() => setPerfOpen(false)}
      />
    </>
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

function AssignCheckRow({
  ok,
  label,
  failHint,
}: {
  ok: boolean;
  label: string;
  failHint?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-[12px]">
      <span className={cn("shrink-0 font-bold", ok ? "text-yesil" : "text-kirmizi")}>
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-gri-700" : "text-kirmizi-koyu"}>
        {label}
        {!ok && failHint && (
          <span className="block text-[11px] text-gri-600 mt-0.5">{failHint}</span>
        )}
      </span>
    </li>
  );
}

function AssignOrderToPartner({
  partner,
  onAssigned,
}: {
  partner: FasonPartner;
  onAssigned: () => void;
}) {
  const toast = useToast();
  type UnassignedOrder = {
    id: string;
    customer: string;
    summary: string;
    detailLine: string;
    total: number;
    firstItem: {
      product: string;
      qty: number;
      width?: number;
      height?: number;
      material?: string;
      materialId?: string;
      formFactor?: string;
    } | null;
  };

  const [unassigned, setUnassigned] = useState<UnassignedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<UnassignedOrder | null>(null);

  const maxCapacity =
    partner.max_concurrent_orders ?? DEFAULT_MAX_CONCURRENT_ORDERS;
  const activeCount = partner.active_order_count ?? 0;
  const capacityOk = activeCount < maxCapacity;
  const contractSigned = partnerCanReceiveAssignments(partner);

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
          items?: Array<{
            product: string;
            title?: string;
            qty: number;
            width?: number;
            height?: number;
            material?: string;
            materialId?: string;
            formFactor?: string;
          }>;
        }>;
      };
      setUnassigned(
        excludeTestOrderLikes(data.orders ?? [])
          .filter((o) => !o.fasonName)
          .map((o) => {
            const first = o.items?.[0] ?? null;
            const cap = first
              ? mapOrderItemToCapability(first.product, {
                  material: first.material,
                  materialId: first.materialId,
                  formFactor: String(first.formFactor ?? ""),
                })
              : null;
            const matLabel =
              cap?.material != null
                ? FASON_MATERIAL_LABELS[cap.material]
                : first?.material ?? "—";
            const size =
              first?.width && first?.height
                ? `${first.width}×${first.height}mm`
                : "";
            const detailLine = [
              first ? `${first.qty.toLocaleString("tr-TR")} adet` : null,
              matLabel,
              size,
            ]
              .filter(Boolean)
              .join(" / ");
            return {
              id: o.id,
              customer: o.address?.name ?? "—",
              total: o.total,
              summary: formatOrderLineSummary(o.items ?? []),
              detailLine,
              firstItem: first,
            };
          })
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

  const capabilityCheck = useMemo(() => {
    if (!confirmOrder?.firstItem) {
      return { ok: true, label: "Urun yetenegi eslesmesi" };
    }
    const cap = mapOrderItemToCapability(confirmOrder.firstItem.product, {
      material: confirmOrder.firstItem.material,
      materialId: confirmOrder.firstItem.materialId,
      formFactor: String(confirmOrder.firstItem.formFactor ?? ""),
    });
    const match = partnerHasApprovedCapability(
      partner.capabilities ?? [],
      cap.productType,
      cap.material
    );
    const productLabel = FASON_PRODUCT_LABELS[cap.productType];
    const materialLabel = cap.material
      ? FASON_MATERIAL_LABELS[cap.material]
      : null;
    const label = materialLabel
      ? `"${productLabel} + ${materialLabel}" yetenek onayli`
      : `"${productLabel}" urun grubu onayli`;
    return { ok: match.ok, label, cap, match };
  }, [confirmOrder, partner.capabilities]);

  const canAssign =
    contractSigned && capacityOk && capabilityCheck.ok;

  const requestAssign = (order: UnassignedOrder) => {
    setConfirmOrder(order);
  };

  const executeAssign = async () => {
    if (!confirmOrder || !canAssign) return;
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
        title={`Siparisi ${partner.name} partnerine ata`}
        maxWidthClassName="max-w-[520px]"
      >
        {confirmOrder && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gri-50 px-3 py-2.5 text-[13px]">
              <p className="font-mono font-semibold text-lacivert">
                #{confirmOrder.id}
              </p>
              <p className="text-gri-700 mt-1">{confirmOrder.customer}</p>
              {confirmOrder.detailLine && (
                <p className="text-gri-600 mt-1">{confirmOrder.detailLine}</p>
              )}
              <p className="text-gri-500 mt-1 text-[12px]">
                Teslim: {partner.default_lead_days} gun (
                {defaultEstimatedDeliveryIso(partner.default_lead_days)})
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">
                Partner durumu
              </h4>
              <ul className="space-y-2">
                <AssignCheckRow
                  ok={contractSigned}
                  label={
                    contractSigned && partner.contract_signed_at
                      ? `Sozlesme imzali (${new Date(partner.contract_signed_at).toLocaleDateString("tr-TR")})`
                      : "Sozlesme imzali"
                  }
                  failHint={
                    <Link
                      href={`/admin/fason/${partner.id}`}
                      className="text-pim-mercan underline"
                    >
                      Sozlesme yukle / imzalandi isaretle
                    </Link>
                  }
                />
                <AssignCheckRow
                  ok={capacityOk}
                  label={
                    capacityOk
                      ? `Kapasite musait (${activeCount}/${maxCapacity})`
                      : `Kapasite dolu (${activeCount}/${maxCapacity})`
                  }
                />
                <AssignCheckRow
                  ok={capabilityCheck.ok}
                  label={capabilityCheck.label}
                  failHint={
                    <span>
                      Sag sidebar{" "}
                      <strong>Yetenekler</strong> bolumunden ekleyip onaylayin
                    </span>
                  }
                />
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={assigningOrderId !== null}
                onClick={() => setConfirmOrder(null)}
              >
                Iptal
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={assigningOrderId !== null || !canAssign}
                onClick={() => void executeAssign()}
              >
                {assigningOrderId ? "Ataniyor..." : "Ata ve Bildir"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function SendPrintFilesButton({
  partnerId,
  orderId,
  onSent,
}: {
  partnerId: string;
  orderId: string;
  onSent?: () => void;
}) {
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/file-transfers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order_id: orderId, file_type: "both" }),
        }
      );
      const json = (await res.json()) as {
        error?: string;
        signed_urls?: Array<{ label: string; url: string }>;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Dosyalar gonderilemedi");
        return;
      }
      const count = json.signed_urls?.length ?? 0;
      toast.success(`${count} dosya linki olusturuldu ve loglandi`);
      onSent?.();
    } catch {
      toast.error("Ag hatasi — tekrar deneyin");
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={sending}
      onClick={() => void send()}
      className="mt-2"
    >
      {sending ? "Hazirlaniyor..." : "Baski dosyalarini gonder"}
    </Button>
  );
}

function PartnerFileTransferLog({ partnerId }: { partnerId: string }) {
  const [items, setItems] = useState<FasonFileTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/file-transfers`
      );
      const json = (await res.json()) as { transfers?: FasonFileTransfer[] };
      setItems(json.transfers ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Skeleton className="h-20 w-full mt-4" />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-4 border-t border-gri-200">
      <h3 className="text-[13px] font-bold uppercase text-gri-500 mb-3">
        Dosya gonderim gecmisi
      </h3>
      <ul className="space-y-2">
        {items.slice(0, 15).map((t) => {
          let fileCount = 0;
          try {
            const parsed = JSON.parse(t.file_url) as { files?: unknown[] };
            fileCount = parsed.files?.length ?? 0;
          } catch {
            fileCount = 0;
          }
          return (
            <li
              key={t.id}
              className="rounded-lg border border-gri-200 bg-gri-50 px-3 py-2 text-[12px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/siparisler/${t.order_id}`}
                  className="font-mono font-semibold text-pim-mercan hover:underline"
                >
                  {t.order_id}
                </Link>
                <span className="text-gri-500">
                  {formatShortDate(t.sent_at)}
                </span>
              </div>
              <div className="text-gri-600 mt-1">
                {FILE_TRANSFER_TYPE_LABEL[t.file_type]} · {fileCount} dosya
              </div>
            </li>
          );
        })}
      </ul>
    </div>
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
  const [transferKey, setTransferKey] = useState(0);
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
                <SendPrintFilesButton
                  partnerId={partner.id}
                  orderId={a.order_id}
                  onSent={() => setTransferKey((k) => k + 1)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <PartnerFileTransferLog key={transferKey} partnerId={partner.id} />

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

function PartnerCommunicationsTab({ partnerId }: { partnerId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<PartnerCommunication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<PartnerCommunicationChannel>("whatsapp");
  const [summary, setSummary] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/communications`
      );
      const json = (await res.json()) as {
        communications?: PartnerCommunication[];
      };
      setItems(json.communications ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      toast.error("Ozet alani zorunlu");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/communications`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channel, summary: summary.trim() }),
        }
      );
      const json = (await res.json()) as {
        communication?: PartnerCommunication;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Kaydedilemedi");
        return;
      }
      if (json.communication) {
        setItems((prev) => [json.communication!, ...prev]);
      }
      setSummary("");
      toast.success("Iletisim kaydi eklendi");
    } catch {
      toast.error("Kaydedilemedi (ag hatasi)");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Bu kayit silinsin mi?")) return;
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/communications`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        }
      );
      if (!res.ok) {
        toast.error("Silinemedi");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Kayit silindi");
    } catch {
      toast.error("Silinemedi (ag hatasi)");
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-[13px] font-bold uppercase text-gri-500">
        Iletisim gecmisi
      </h2>

      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-xl border border-gri-200 bg-gri-50/50 p-4 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
          <div>
            <label
              htmlFor={`comm-channel-${partnerId}`}
              className="text-[11px] font-semibold text-gri-600 block mb-1"
            >
              Kanal
            </label>
            <select
              id={`comm-channel-${partnerId}`}
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as PartnerCommunicationChannel)
              }
              className="w-full h-9 px-2 text-[12px] border border-gri-200 rounded-lg bg-white"
            >
              {(Object.keys(COMMUNICATION_CHANNEL_LABEL) as PartnerCommunicationChannel[]).map(
                (c) => (
                  <option key={c} value={c}>
                    {COMMUNICATION_CHANNEL_LABEL[c]}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label
              htmlFor={`comm-summary-${partnerId}`}
              className="text-[11px] font-semibold text-gri-600 block mb-1"
            >
              Ozet
            </label>
            <textarea
              id={`comm-summary-${partnerId}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Ornek: Teslim tarihi guncellendi, onay alindi..."
              className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan outline-none text-[13px] resize-y bg-white"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kayit ekle"}
          </Button>
        </div>
      </form>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-[13px] text-gri-600 py-2">
          Henuz manuel iletisim kaydi yok.
        </p>
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-gri-200 p-3 text-[12px]"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-lacivert/10 text-lacivert text-[10.5px] font-semibold">
                  {COMMUNICATION_CHANNEL_LABEL[item.channel]}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gri-500">
                    {new Date(item.created_at).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    className="text-[11px] text-kirmizi hover:underline"
                  >
                    Sil
                  </button>
                </div>
              </div>
              <p className="text-gri-700 whitespace-pre-wrap leading-relaxed">
                {item.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
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
  const [historyPage, setHistoryPage] = useState(1);

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

  useEffect(() => {
    setHistoryPage(1);
  }, [partner.id, tab]);

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

  const historyTotalPages = Math.max(
    1,
    Math.ceil(completedHistory.length / HISTORY_PAGE_SIZE)
  );
  const pagedCompletedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return completedHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [completedHistory, historyPage]);

  const tabs: Array<{ id: PartnerDetailTab; label: string }> = [
    { id: "jobs", label: "Atanan isler" },
    { id: "partner", label: "Partner detayi" },
    { id: "history", label: "Gecmis isler" },
    { id: "communications", label: "Iletisim gecmisi" },
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
              <>
                <ul className="space-y-2">
                  {pagedCompletedHistory.map((a) => (
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
                {historyTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-gri-600 tabular-nums">
                      Sayfa {historyPage} / {historyTotalPages} ·{" "}
                      {completedHistory.length} kayit
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={historyPage <= 1}
                        onClick={() =>
                          setHistoryPage((p) => Math.max(1, p - 1))
                        }
                      >
                        Onceki
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={historyPage >= historyTotalPages}
                        onClick={() =>
                          setHistoryPage((p) =>
                            Math.min(historyTotalPages, p + 1)
                          )
                        }
                      >
                        Sonraki
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "communications" && (
          <PartnerCommunicationsTab partnerId={partner.id} />
        )}
      </Card>

      <PartnerSidebar
        partner={partner}
        onPartnerUpdated={onPartnerUpdated}
      />
    </div>
  );
}
