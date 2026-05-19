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
}

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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fason/partners");
      const json = (await res.json()) as { partners?: FasonPartner[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "list_failed");
      setPartners(json.partners ?? []);
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

  // ============================================================
  // Computed
  // ============================================================

  const filtered = useMemo(() => {
    if (filter === "all") return partners;
    if (filter === "active") return partners.filter((p) => p.active);
    if (filter === "no_contract")
      return partners.filter((p) => !p.contract_signed_at);
    return partners;
  }, [partners, filter]);

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
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Icon.Plus size={14} /> Yeni partner ekle
          </Button>
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

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap mb-4">
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
        </div>

        {/* Grid: partners (sol) + history (sağ) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          {/* Partners */}
          <div className="space-y-3">
            {loading && <Skeleton.AdminTable rows={4} />}
            {!loading && filtered.length === 0 && (
              <Card padding="p-8" className="text-center">
                <div className="text-gri-700 mb-3">
                  Bu filtreye uyan üretim partneri yok.
                </div>
                <Button variant="secondary" onClick={() => setShowAdd(true)}>
                  <Icon.Plus size={14} /> İlk partneri ekle
                </Button>
              </Card>
            )}
            {filtered.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                isSelected={selected?.id === p.id}
                onSelect={() => setSelected(p)}
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
                  {history.slice(0, 15).map((a) => {
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
                      <span className="text-yesil font-semibold">
                        {new Date(selected.contract_signed_at).toLocaleDateString(
                          "tr-TR"
                        )}
                      </span>
                    ) : (
                      <span className="text-kirmizi font-semibold">
                        İmzasız
                      </span>
                    )}
                  </div>
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
// PartnerCard
// ============================================================

function PartnerCard({
  partner,
  isSelected,
  onSelect,
}: {
  partner: FasonPartner;
  isSelected: boolean;
  onSelect: () => void;
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "block w-full text-left transition-all",
        isSelected ? "ring-2 ring-pim-mercan" : ""
      )}
    >
      <Card padding="p-5" className={isSelected ? "!ring-pim-mercan" : ""}>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{partner.name}</h3>
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
            {!partner.active && (
              <span className="inline-flex items-center h-[24px] px-2.5 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
                Pasif
              </span>
            )}
          </div>
        </div>

        {/* Specialties */}
        {partner.specialties.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {partner.specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-semibold capitalize"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-[12px] text-gri-700 pt-3 border-t border-gri-100">
          <span>
            ⏱ Tipik teslim:{" "}
            <strong className="text-lacivert">{partner.default_lead_days}</strong>{" "}
            gün
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
    </button>
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
