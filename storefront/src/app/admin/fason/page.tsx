/**
 * Pim Etiket — /admin/fason
 *
 * Fason ortaklar yönetimi (gerçek DB — fason_partners + v_fason_performance).
 *
 * Yapı:
 *   1. Üst — KPI strip (toplam ortak, aktif, ortalama skor, sözleşmesiz)
 *   2. Partner kartları — tıklanınca /admin/fason/[partnerId] detay sayfası
 *   3. Modal — yeni fason ekle (legacy)
 *
 * Hardcoded demo data KALDIRILDI. Migration 018 + 021 ile besleniyor.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Input, Modal, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  CAPABILITY_LABEL,
  type FasonPartner,
} from "@/components/admin/fason/fason-types";
import { PartnerActions } from "@/components/admin/fason/partner-detail-view";

type SortBy = "score" | "name" | "lead_days" | "active_orders";

// ============================================================
// Page
// ============================================================

export default function AdminFasonPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<FasonPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "no_contract">(
    "active"
  );
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("score");

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
                onOpen={() => router.push(`/admin/fason/${p.id}`)}
                onRefresh={() => void refresh()}
              />
            ))}
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
  onOpen,
  onRefresh,
}: {
  partner: FasonPartner;
  onOpen: () => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [markingContract, setMarkingContract] = useState(false);

  const markContractSigned = async () => {
    if (
      !confirm(
        `${partner.name} icin sozlesme imzalandi olarak isaretlensin mi?`
      )
    ) {
      return;
    }
    setMarkingContract(true);
    try {
      const res = await fetch(`/api/admin/fason/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractSignedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Sozlesme kaydedilemedi");
        return;
      }
      toast.success("Sozlesme imzalandi olarak isaretlendi");
      onRefresh();
    } catch {
      toast.error("Sozlesme kaydedilemedi (ag hatasi)");
    } finally {
      setMarkingContract(false);
    }
  };

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
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="block w-full text-left transition-all cursor-pointer hover:ring-2 hover:ring-pim-mercan/40 rounded-xl"
    >
      <Card padding="p-5">
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
                 Sonlandırıldı
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 -my-0.5 transition-colors",
              "hover:bg-pim-mercan-tint hover:text-pim-mercan"
            )}
            title="Atanan isleri gor"
          >
             Aktif:{" "}
            <strong className="tabular-nums">
              {partner.active_order_count ?? 0}
            </strong>{" "}
            sipariş
            <Icon.ChevR size={10} className="opacity-70" />
          </button>
          {partner.contract_signed_at ? (
            <span className="text-yesil font-semibold ml-auto">
               Sözleşmeli
            </span>
          ) : (
            <span className="text-kirmizi font-semibold ml-auto">
               Sözleşmesiz
            </span>
          )}
        </div>
        {!partner.contract_signed_at && (
          <div
            className="mt-3 flex flex-wrap gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={markingContract}
              onClick={() => void markContractSigned()}
            >
              {markingContract ? "Kaydediliyor..." : "Sozlesme imzalandi olarak isaretle"}
            </Button>
            <a
              href={`mailto:${partner.contact_email}?subject=${encodeURIComponent("KVKK Veri Isleyici Sozlesmesi")}`}
              className="inline-flex items-center h-8 px-3 rounded-lg text-[12px] font-semibold text-gri-700 hover:bg-gri-100 ring-1 ring-gri-200"
              onClick={(e) => e.stopPropagation()}
            >
              Sozlesme talep et (e-posta)
            </a>
          </div>
        )}
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
