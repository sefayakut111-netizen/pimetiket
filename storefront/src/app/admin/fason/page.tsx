/**
 * Pim Etiket — /admin/fason
 *
 * Fason ortaklar yönetimi (gerçek DB — fason_partners + v_fason_performance).
 *
 * Yapı:
 *   1. Üst — KPI strip (toplam ortak, aktif, ortalama skor, sözleşmesiz)
 *   2. Sol — partner kartları (skor, uzmanlık, sözleşme durumu)
 *   3. Sağ — seçili partnerin son atamaları
 *   4. Modal — yeni fason ekle
 *
 * Hardcoded demo data KALDIRILDI. Migration 018 + 021 ile besleniyor.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Input, Modal, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getAdminPillClasses,
  type AssignmentStatus,
} from "@/lib/fason/status-labels";

// ============================================================
// Types
// ============================================================

interface FasonPartner {
  id: string;
  name: string;
  // Mig 067 yeni alanlar
  short_name?: string | null;
  city?: string | null;
  town?: string | null;
  status?: "active" | "paused" | "terminated";
  status_reason?: string | null;
  express_lead_time_days?: number | null;
  min_order_amount_try?: number | null;
  payment_term?: string | null;
  iban?: string | null;
  contract_pdf_url?: string | null;
  contract_uploaded_at?: string | null;
  // Mig 018 mevcut alanlar
  contact_email: string;
  contact_whatsapp: string | null;
  contact_person: string | null;
  specialties: string[];
  default_lead_days: number;
  cached_score: number | null;
  score_updated_at: string | null;
  active: boolean;
  contract_signed_at: string | null;
  notes: string | null;
  created_at: string;
  active_order_count?: number;
  // Mig 067 nested
  contacts?: Array<{
    role: string;
    name: string;
    email: string;
    phone_e164: string;
    auto_notification?: boolean;
  }>;
  capabilities?: Array<{
    id: string;
    capability_type: "product_type" | "material";
    capability_value: string;
    is_verified?: boolean;
  }>;
}

const CAPABILITY_LABEL: Record<string, string> = {
  roll_label: "Rulo",
  sheet_label: "Tabaka",
  sticker: "Sticker",
  paper: "Kağıt",
  transparent: "Şeffaf",
  metallic: "Metalize",
  holographic: "Holografik",
};

interface AssignmentRow {
  id: string;
  order_id: string;
  fason_partner_id: string;
  status: string;
  assigned_at: string;
  estimated_delivery: string | null;
  actual_delivery: string | null;
}

// Status etiketleri tek kaynaktan (src/lib/fason/status-labels.ts):
// getAdminPillClasses(status) — label + Tailwind chip className döner.

type SortBy = "score" | "name" | "lead_days" | "active_orders";

const HISTORY_PAGE_SIZE = 10;

// ============================================================
// Page
// ============================================================

export default function AdminFasonPage() {
  const [partners, setPartners] = useState<FasonPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FasonPartner | null>(null);
  const [history, setHistory] = useState<AssignmentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "no_contract">(
    "active"
  );
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [historyPage, setHistoryPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fason/partners");
      const json = (await res.json()) as { partners?: FasonPartner[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "list_failed");
      const newPartners = json.partners ?? [];
      setPartners(newPartners);
      setSelected((prev) => {
        if (!prev) return prev;
        return newPartners.find((p) => p.id === prev.id) ?? null;
      });
    } catch (err) {
      console.error("[admin/fason] list error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadHistory = useCallback(async (partnerId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/admin/fason/assignments?partnerId=${encodeURIComponent(partnerId)}`
      );
      const json = (await res.json()) as { assignments?: AssignmentRow[] };
      setHistory(json.assignments ?? []);
    } catch (err) {
      console.error("[admin/fason] history error:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadHistory(selected.id);
  }, [selected, loadHistory]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selected?.id]);

  // ============================================================
  // Computed
  // ============================================================

  const filtered = useMemo(() => {
    let list = partners;
    if (filter === "active") list = list.filter((p) => p.active);
    if (filter === "no_contract")
      list = list.filter((p) => !p.contract_signed_at);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.contact_email.toLowerCase().includes(q) ||
          (p.city ?? "").toLowerCase().includes(q) ||
          (p.contact_person ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [partners, filter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      switch (sortBy) {
        case "score":
          return (b.cached_score ?? 0) - (a.cached_score ?? 0);
        case "name":
          return a.name.localeCompare(b.name, "tr");
        case "lead_days":
          return a.default_lead_days - b.default_lead_days;
        case "active_orders":
          return (b.active_order_count ?? 0) - (a.active_order_count ?? 0);
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sortBy]);

  const pagedHistory = history.slice(0, historyPage * HISTORY_PAGE_SIZE);
  const hasMoreHistory = history.length > pagedHistory.length;

  const stats = useMemo(() => {
    const total = partners.length;
    const active = partners.filter((p) => p.active).length;
    const withScore = partners.filter((p) => p.cached_score != null);
    const avgScore =
      withScore.length === 0
        ? null
        : withScore.reduce((s, p) => s + (p.cached_score ?? 0), 0) /
          withScore.length;
    const noContract = partners.filter((p) => !p.contract_signed_at).length;
    return { total, active, avgScore, noContract };
  }, [partners]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Üretim Partnerleri</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Üretim Partnerleri
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              {stats.total} ortak · {stats.active} aktif
              {stats.noContract > 0 && (
                <>
                  {" · "}
                  <span className="text-kirmizi font-semibold">
                    {stats.noContract} sözleşmesiz
                  </span>
                </>
              )}
            </p>
          </div>
          {/* Sefa 20 May v68: Yeni partner artık ayrı sayfa (/admin/fason/yeni) —
              4-kart form (firma + 3 yetkili + yetkinlik + sözleşme).
              Modal (PartnerAddModal) legacy backward-compat için duruyor. */}
          <Link
            href="/admin/fason/yeni"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-pim-mercan text-white text-[13.5px] font-semibold hover:bg-pim-mercan/90 transition-colors"
          >
            <Icon.Plus size={14} /> Yeni partner ekle
          </Link>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Toplam ortak"
            value={stats.total.toString()}
            tone="neutral"
          />
          <KpiCard
            label="Aktif"
            value={stats.active.toString()}
            tone="success"
          />
          <KpiCard
            label="Ortalama skor"
            value={
              stats.avgScore == null
                ? "—"
                : (stats.avgScore * 100).toFixed(0) + " / 100"
            }
            tone="brand"
          />
          <KpiCard
            label="Sözleşmesiz"
            value={stats.noContract.toString()}
            tone={stats.noContract > 0 ? "danger" : "success"}
          />
        </div>

        {/* Sözleşmesiz uyarı */}
        {stats.noContract > 0 && (
          <div className="mb-6 rounded-xl bg-kirmizi-soft ring-1 ring-kirmizi/30 px-5 py-3.5 flex items-start gap-3">
            <Icon.Info size={16} className="text-kirmizi mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-[13.5px] text-kirmizi mb-0.5">
                {stats.noContract} ortakla veri işleyici sözleşmesi imzalanmamış
              </div>
              <p className="text-[12.5px] text-gri-700 leading-relaxed">
                KVKK m.12 uyarınca veri işleyici sözleşmesi olmadan
                aktarım yapamayız. Atama denemeleri bloklanır.
              </p>
            </div>
          </div>
        )}

        {/* Filter chips + arama + sıralama */}
        <div className="flex gap-2 flex-wrap mb-4 items-center">
          {(
            [
              { id: "active" as const, label: "Aktif" },
              { id: "all" as const, label: "Tümü" },
              { id: "no_contract" as const, label: "Sözleşmesiz" },
            ]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                filter === f.id
                  ? "bg-lacivert text-white"
                  : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100"
              )}
            >
              {f.label}
            </button>
          ))}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-9 px-2 text-[12px] border border-gri-200 rounded-lg bg-white"
          >
            <option value="score">Skor (yüksek → düşük)</option>
            <option value="name">İsim (A-Z)</option>
            <option value="lead_days">Teslim süresi (hızlı → yavaş)</option>
            <option value="active_orders">Aktif sipariş (çok → az)</option>
          </select>

          <div className="ml-auto w-full sm:w-auto sm:min-w-[240px] relative">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Partner ara (isim/email/şehir)…"
              className="!h-10 !pl-9"
            />
            <Icon.Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gri-500 pointer-events-none"
            />
          </div>
        </div>

        {/* Grid: partners (sol) + history (sağ) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          {/* Partners */}
          <div className="space-y-3">
            {loading && <Skeleton.AdminTable rows={4} />}
            {!loading && sorted.length === 0 && (
              <Card padding="p-8" className="text-center">
                <div className="text-gri-700 mb-3">
                  Bu filtreye uyan üretim partneri yok.
                </div>
                <Button variant="secondary" onClick={() => setShowAdd(true)}>
                  <Icon.Plus size={14} /> İlk partneri ekle
                </Button>
              </Card>
            )}
            {sorted.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                isSelected={selected?.id === p.id}
                onSelect={() => setSelected(p)}
                onRefresh={() => {
                  void refresh();
                  if (selected?.id === p.id) {
                    void loadHistory(p.id);
                  }
                }}
              />
            ))}
          </div>

          {/* History panel */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-5">
              <h3 className="font-semibold text-base mb-3">
                {selected ? selected.name : "Atama geçmişi"}
              </h3>
              {!selected && (
                <p className="text-[13px] text-gri-700">
                  Detay görmek için bir ortak seç.
                </p>
              )}
              {selected && (
                <PartnerCapabilitiesPanel
                  partner={selected}
                  onUpdated={(updated) => {
                    setSelected(updated);
                    void refresh();
                  }}
                />
              )}
              {selected && (
                <PartnerScoreBreakdown partner={selected} history={history} />
              )}
              {selected && historyLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
              {selected && !historyLoading && history.length === 0 && (
                <p className="text-[13px] text-gri-700">
                  Henüz atama yok.
                </p>
              )}
              {selected && history.length > 0 && (
                <ul className="space-y-2">
                  {pagedHistory.map((a) => {
                    const meta = getAdminPillClasses(
                      a.status as AssignmentStatus
                    );
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 text-[12.5px] border-b border-gri-100 pb-2 last:border-0 last:pb-0"
                      >
                        <Link
                          href={`/admin/siparisler/${a.order_id}`}
                          className="font-mono text-[11.5px] text-pim-mercan hover:underline truncate"
                        >
                          {a.order_id}
                        </Link>
                        <span
                          className={cn(
                            "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-semibold shrink-0",
                            meta.className
                          )}
                        >
                          {meta.label}
                        </span>
                        <span className="text-gri-500 shrink-0 tabular-nums">
                          {new Date(a.assigned_at).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {selected && hasMoreHistory && (
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="mt-2 w-full text-center text-[12px] font-semibold text-pim-mercan hover:underline py-2"
                >
                  Daha fazla göster ({history.length - pagedHistory.length}{" "}
                  kalan)
                </button>
              )}
              {selected && (
                <div className="mt-4 pt-3 border-t border-gri-100 space-y-1.5 text-[12px] text-gri-700">
                  <div>
                    📧{" "}
                    <a
                      href={`mailto:${selected.contact_email}`}
                      className="text-pim-mercan hover:underline"
                    >
                      {selected.contact_email}
                    </a>
                  </div>
                  {selected.contact_whatsapp && (
                    <div>📱 {selected.contact_whatsapp}</div>
                  )}
                  {selected.contact_person && (
                    <div>👤 {selected.contact_person}</div>
                  )}
                  <div>
                    📑 Sözleşme:{" "}
                    {selected.contract_signed_at ? (
                      <>
                        <span className="text-yesil font-semibold">
                          {new Date(
                            selected.contract_signed_at
                          ).toLocaleDateString("tr-TR")}
                        </span>
                        {selected.contract_pdf_url && (
                          <a
                            href={selected.contract_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-pim-mercan font-semibold hover:underline text-[11px]"
                          >
                            📥 PDF indir
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-kirmizi font-semibold">
                        İmzasız
                      </span>
                    )}
                  </div>
                  <PartnerMailLog partnerId={selected.id} />
                  <AssignOrderToPartner
                    partnerId={selected.id}
                    partnerName={selected.name}
                    onAssigned={() => void loadHistory(selected.id)}
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddPartnerModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            void refresh();
          }}
        />
      )}
    </main>
  );
}

// ============================================================
// KpiCard
// ============================================================

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "danger" | "brand";
}) {
  const toneClass = {
    neutral: "bg-white ring-gri-200",
    success: "bg-yesil-soft ring-yesil/30",
    danger: "bg-kirmizi-soft ring-kirmizi/30",
    brand: "bg-pim-mercan-tint ring-pim-mercan/30",
  }[tone];
  return (
    <Card
      padding="p-4"
      className={cn("!ring-1", toneClass)}
    >
      <div className="text-[11.5px] text-gri-700 font-semibold mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold tabular-nums">{value}</div>
    </Card>
  );
}

// ============================================================
// PartnerCapabilitiesPanel
// ============================================================

function PartnerCapabilitiesPanel({
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
                  ✅ Onaylı
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId === c.id}
                  onClick={() => void verify(c.id, true)}
                >
                  ⏳ Onayla
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

function PartnerActions({
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
              ✕ Sonlandır
            </button>
          )}
          <div className="border-t border-gri-100 my-1" />
          <Link
            href={`/admin/fason/yeni?edit=${partner.id}`}
            className="block px-3 py-2 text-[13px] hover:bg-gri-50 text-lacivert"
            onClick={() => setOpen(false)}
          >
            ✏️ Düzenle
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PartnerScoreBreakdown
// ============================================================

function PartnerScoreBreakdown({
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
            new Date(a.assigned_at).getTime()) /
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

function PartnerMailLog({ partnerId }: { partnerId: string }) {
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
            <span>📧 {m.template.replace(/_/g, " ")}</span>
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

function AssignOrderToPartner({
  partnerId,
  partnerName,
  onAssigned,
}: {
  partnerId: string;
  partnerName: string;
  onAssigned: () => void;
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

  if (loading || unassigned.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gri-100">
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

// ============================================================
// PartnerCard
// ============================================================

function PartnerCard({
  partner,
  isSelected,
  onSelect,
  onRefresh,
}: {
  partner: FasonPartner;
  isSelected: boolean;
  onSelect: () => void;
  onRefresh: () => void;
}) {
  const scorePct =
    partner.cached_score == null ? null : Math.round(partner.cached_score * 100);

  const scoreColor =
    scorePct == null
      ? "bg-gri-100 text-gri-700"
      : scorePct >= 75
        ? "bg-yesil-soft text-yesil"
        : scorePct >= 50
          ? "bg-sari-soft text-sari-koyu"
          : "bg-kirmizi-soft text-kirmizi";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "block w-full text-left transition-all cursor-pointer",
        isSelected ? "ring-2 ring-pim-mercan rounded-xl" : ""
      )}
    >
      <Card padding="p-5" className={isSelected ? "!ring-pim-mercan" : ""}>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">
              {partner.name}
              {/* Sefa 20 May v68: Mig 067 city göster */}
              {partner.city && (
                <span className="text-[12px] font-normal text-gri-700 ml-2">
                  · {partner.city}
                </span>
              )}
            </h3>
            <div className="text-[12px] text-gri-700 mt-0.5 truncate">
              {partner.contact_email}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {scorePct != null && (
              <span
                className={cn(
                  "inline-flex items-center h-[24px] px-2.5 rounded-full text-[11.5px] font-semibold tabular-nums",
                  scoreColor
                )}
              >
                {scorePct} / 100
              </span>
            )}
            <PartnerActions partner={partner} onUpdated={onRefresh} />
            {/* Mig 067 status enum (paused/terminated), legacy active fallback */}
            {(partner.status === "paused" ||
              (partner.status === undefined && !partner.active)) && (
              <span
                className="inline-flex items-center h-[24px] px-2.5 rounded-full bg-sari-soft text-sari-koyu text-[11px] font-semibold"
                title={partner.status_reason ?? undefined}
              >
                ◐ Pasif
              </span>
            )}
            {partner.status === "terminated" && (
              <span className="inline-flex items-center h-[24px] px-2.5 rounded-full bg-kirmizi-soft text-kirmizi text-[11px] font-semibold">
                ✕ Sonlandırıldı
              </span>
            )}
          </div>
        </div>

        {/* Sefa 20 May v68: Mig 067 capabilities (product_type + material) */}
        {partner.capabilities && partner.capabilities.length > 0 ? (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {partner.capabilities
              .filter((c) => c.capability_type === "product_type")
              .map((c) => (
                <span
                  key={`pt-${c.capability_value}`}
                  className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-semibold"
                >
                  {CAPABILITY_LABEL[c.capability_value] ?? c.capability_value}
                </span>
              ))}
            {partner.capabilities
              .filter((c) => c.capability_type === "material")
              .map((c) => (
                <span
                  key={`mat-${c.capability_value}`}
                  className="inline-flex items-center h-[20px] px-2 rounded-full bg-lacivert/10 text-lacivert text-[10.5px] font-semibold"
                >
                  {CAPABILITY_LABEL[c.capability_value] ?? c.capability_value}
                </span>
              ))}
          </div>
        ) : (
          partner.specialties.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              {/* Eski legacy specialties (Mig 018 öncesi) */}
              {partner.specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-semibold capitalize"
                >
                  {s}
                </span>
              ))}
            </div>
          )
        )}

        <div className="flex items-center gap-3 text-[12px] text-gri-700 pt-3 border-t border-gri-100 flex-wrap">
          <span>
            ⏱ Tipik teslim:{" "}
            <strong className="text-lacivert">{partner.default_lead_days}</strong>{" "}
            gün
          </span>
          <span>
            📦 Aktif:{" "}
            <strong className="text-lacivert">
              {partner.active_order_count ?? "?"}
            </strong>{" "}
            sipariş
          </span>
          {partner.contract_signed_at ? (
            <span className="text-yesil font-semibold ml-auto">
              ✓ Sözleşmeli
            </span>
          ) : (
            <span className="text-kirmizi font-semibold ml-auto">
              ⚠ Sözleşmesiz
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// AddPartnerModal
// ============================================================

function AddPartnerModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const nameId = `fason-name-${Math.random().toString(36).slice(2, 7)}`;
  const emailId = `fason-email-${Math.random().toString(36).slice(2, 7)}`;
  const personId = `fason-person-${Math.random().toString(36).slice(2, 7)}`;
  const waId = `fason-wa-${Math.random().toString(36).slice(2, 7)}`;
  const specId = `fason-spec-${Math.random().toString(36).slice(2, 7)}`;
  const leadId = `fason-lead-${Math.random().toString(36).slice(2, 7)}`;
  const contractId = `fason-contract-${Math.random().toString(36).slice(2, 7)}`;
  const notesId = `fason-notes-${Math.random().toString(36).slice(2, 7)}`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [specInput, setSpecInput] = useState("");
  const [leadDays, setLeadDays] = useState(7);
  const [contractSignedAt, setContractSignedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim().includes("@")) {
      setError("Ad ve e-posta zorunlu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/fason/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact_email: email.trim().toLowerCase(),
          contact_whatsapp: whatsapp.trim() || null,
          contact_person: contactPerson.trim() || null,
          specialties: specInput
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          default_lead_days: leadDays,
          contract_signed_at: contractSignedAt || null,
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Eklenemedi");
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Yeni üretim partneri">
      <div className="space-y-3">
        <div>
          <label htmlFor={nameId} className="text-[12.5px] font-semibold mb-1 block">
            Ad / unvan *
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: İstanbul İkitelli Etiket Atölyesi"
            autoComplete="organization"
          />
        </div>
        <div>
          <label htmlFor={emailId} className="text-[12.5px] font-semibold mb-1 block">
            E-posta *
          </label>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="atolye@ornek.com"
            autoComplete="email"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor={personId} className="text-[12.5px] font-semibold mb-1 block">
              İletişim kişisi
            </label>
            <Input
              id={personId}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Ahmet Yılmaz"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor={waId} className="text-[12.5px] font-semibold mb-1 block">
              WhatsApp
            </label>
            <Input
              id={waId}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+90 5XX XXX XX XX"
              autoComplete="tel"
            />
          </div>
        </div>
        <div>
          <label htmlFor={specId} className="text-[12.5px] font-semibold mb-1 block">
            Uzmanlık (virgülle ayır)
          </label>
          <Input
            id={specId}
            value={specInput}
            onChange={(e) => setSpecInput(e.target.value)}
            placeholder="etiket, sticker, yaldız"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor={leadId} className="text-[12.5px] font-semibold mb-1 block">
              Tipik teslim (gün)
            </label>
            <Input
              id={leadId}
              type="number"
              value={String(leadDays)}
              onChange={(e) =>
                setLeadDays(Math.max(1, Math.min(60, Number(e.target.value) || 7)))
              }
              min={1}
              max={60}
            />
          </div>
          <div>
            <label htmlFor={contractId} className="text-[12.5px] font-semibold mb-1 block">
              Sözleşme tarihi
            </label>
            <Input
              id={contractId}
              type="date"
              value={contractSignedAt}
              onChange={(e) => setContractSignedAt(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor={notesId} className="text-[12.5px] font-semibold mb-1 block">
            Notlar
          </label>
          <textarea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ek bilgi, kapasite, özel anlaşmalar…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan outline-none text-[13px] resize-y"
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-kirmizi-soft text-kirmizi text-[12.5px]">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-gri-700">
          * Sözleşmesiz partner&apos;a atama bloklanır.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            İptal
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
