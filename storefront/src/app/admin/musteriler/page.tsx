/**
 * Pim Etiket — /admin/musteriler (Sefa 17 May yeni CRM)
 *
 * Migration 046 v_admin_customers view'den okur.
 * Eski versiyon: localStorage orders'tan aggregate → sadece sipariş verenler.
 * Yeni versiyon: auth.users + orders join → kayıtlı tüm kullanıcılar.
 *
 * Yapı:
 *   - 4 KPI kart (Toplam · Tekrar+VIP · Risk · Sipariş yok)
 *   - Segment chip filtresi (Tümü · VIP · Tekrar · Yeni · Risk · Kayıp · Sipariş yok)
 *   - Search (email/ad/telefon)
 *   - Bulk select skeleton (Sprint 3'te aksiyon eklenecek)
 *   - Tablo: müşteri · segment · sipariş · ciro · email · 2FA · son hareket
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Input, Eyebrow, Skeleton, Button, useToast } from "@/components/ui";
import { StatusDot, type DotColor } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import type {
  AdminCustomerWithSegment,
} from "@/app/api/admin/customers/route";

type Segment = AdminCustomerWithSegment["segment"];
type SegmentFilter = Segment | "all";

interface KPI {
  total: number;
  vip: number;
  repeat: number;
  new: number;
  risk: number;
  lost: number;
  no_order: number;
  total_revenue: number;
}

const SEGMENT_META: Record<
  Segment,
  { label: string; dot?: DotColor; color: string; bg: string; ring: string }
> = {
  vip: {
    label: "VIP",
    dot: "sari",
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
    ring: "ring-sari-soft",
  },
  repeat: {
    label: "Tekrar",
    dot: "yesil",
    color: "text-yesil",
    bg: "bg-yesil-soft",
    ring: "ring-yesil/30",
  },
  new: {
    label: "Yeni",
    dot: "mercan",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
    ring: "ring-pim-mercan-soft",
  },
  risk: {
    label: "Risk",
    dot: "sari",
    color: "text-saman-koyu",
    bg: "bg-saman/15",
    ring: "ring-saman/30",
  },
  lost: {
    label: "Kayıp",
    dot: "kirmizi",
    color: "text-kirmizi",
    bg: "bg-kirmizi/10",
    ring: "ring-kirmizi/20",
  },
  no_order: {
    label: "Sipariş yok",
    dot: "gri",
    color: "text-gri-700",
    bg: "bg-gri-100",
    ring: "ring-gri-200",
  },
};

const FILTER_OPTIONS: { id: SegmentFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "vip", label: "VIP" },
  { id: "repeat", label: "Tekrar" },
  { id: "new", label: "Yeni" },
  { id: "risk", label: "Risk" },
  { id: "lost", label: "Kayıp" },
  { id: "no_order", label: "Sipariş yok" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminMusterilerPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<AdminCustomerWithSegment[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Sprint 3: bulk email modal
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ segment, limit: "200" });
    if (search) params.set("search", search);
    fetch(`/api/admin/customers?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (j: {
          ok?: boolean;
          customers?: AdminCustomerWithSegment[];
          kpi?: KPI;
          error?: string;
        }) => {
          if (cancelled) return;
          if (!j.ok || !j.customers) {
            setError(j.error ?? "fetch_failed");
            return;
          }
          setError(null);
          setCustomers(j.customers);
          if (j.kpi) setKpi(j.kpi);
        }
      )
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "network");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, segment]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length && customers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.user_id)));
    }
  };

  // Sprint 3 — bulk handlers
  const handleBulkEmail = async () => {
    if (selectedIds.size === 0) return;
    if (bulkSubject.trim().length < 2 || bulkBody.trim().length < 10) {
      toast.error("Konu 2+ karakter, içerik 10+ karakter olmalı");
      return;
    }
    setBulkSending(true);
    try {
      const r = await fetch("/api/admin/customers/bulk/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_ids: Array.from(selectedIds),
          subject: bulkSubject.trim(),
          body_text: bulkBody.trim(),
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        enqueued?: number;
        skipped?: number;
        error?: string;
      };
      if (j.ok) {
        toast.success(
          ` ${j.enqueued} email kuyruğa eklendi${j.skipped ? ` (${j.skipped} atlandı)` : ""}`
        );
        setBulkEmailOpen(false);
        setBulkSubject("");
        setBulkBody("");
        setSelectedIds(new Set());
      } else {
        toast.error(j.error ?? "Toplu email başarısız");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ağ hatası");
    } finally {
      setBulkSending(false);
    }
  };

  const handleCsvExport = () => {
    const params = new URLSearchParams({ segment });
    if (search) params.set("search", search);
    window.open(
      `/api/admin/customers/export?${params.toString()}`,
      "_blank"
    );
  };

  const repeatPlusVip = useMemo(
    () => (kpi ? kpi.repeat + kpi.vip : 0),
    [kpi]
  );
  const repeatRate = useMemo(() => {
    if (!kpi || kpi.total === 0) return 0;
    return Math.round((repeatPlusVip / kpi.total) * 100);
  }, [kpi, repeatPlusVip]);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <Eyebrow>CRM</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Müşteriler
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {kpi
              ? `${kpi.total} kayıtlı kullanıcı · ${repeatPlusVip} tekrar eden (${repeatRate}%) · ${fmt(kpi.total_revenue)} ₺ toplam ciro`
              : "—"}
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "Toplam kayıtlı",
              value: kpi?.total ?? 0,
              accent: "text-pim-mercan",
              bg: "bg-pim-mercan-tint",
              filter: "all" as SegmentFilter,
            },
            {
              label: "VIP + Tekrar",
              value: repeatPlusVip,
              accent: "text-yesil",
              bg: "bg-yesil-soft",
              filter: "repeat" as SegmentFilter,
            },
            {
              label: "Risk + Kayıp",
              value: (kpi?.risk ?? 0) + (kpi?.lost ?? 0),
              accent: "text-saman-koyu",
              bg: "bg-saman/15",
              filter: "risk" as SegmentFilter,
            },
            {
              label: "Sipariş vermemiş",
              value: kpi?.no_order ?? 0,
              accent: "text-gri-700",
              bg: "bg-gri-100",
              filter: "no_order" as SegmentFilter,
            },
          ].map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => setSegment(k.filter)}
              className={cn(
                "rounded-2xl bg-white ring-1 ring-gri-200 p-4 text-left transition-all",
                "hover:ring-pim-mercan hover:-translate-y-0.5",
                segment === k.filter && "ring-pim-mercan ring-2"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid place-items-center w-10 h-10 rounded-xl shrink-0",
                    k.bg,
                    k.accent
                  )}
                >
                  <Icon.User size={16} />
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    {k.label}
                  </div>
                  <div
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      k.accent
                    )}
                  >
                    {k.value}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Filter chips + Search */}
        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSegment(f.id)}
                className={cn(
                  "px-3.5 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  segment === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
                {f.id !== "all" && kpi && (
                  <span className="ml-1.5 opacity-70">
                    ({kpi[f.id as keyof KPI] ?? 0})
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px]">
              <div className="relative">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Email, ad, telefon ara…"
                  className="!h-11 !pl-10"
                />
                <Icon.Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Sprint 3: Bulk action bar (aktif) */}
        {selectedIds.size > 0 && (
          <Card
            padding="p-3"
            className="mb-4 !bg-pim-mercan-tint ring-pim-mercan/30 sticky top-4 z-10 shadow-1"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-[13.5px] text-lacivert">
                {selectedIds.size} müşteri seçili
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[12px] font-semibold text-gri-700 hover:text-kirmizi"
              >
                Seçimi kaldır
              </button>
              <div className="ml-auto flex gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setBulkEmailOpen(true)}
                >
                   Toplu email at
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCsvExport}
                >
                   CSV indir (filtreli)
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* CSV export button — her zaman görünür (filtreye göre çalışır) */}
        {selectedIds.size === 0 && customers.length > 0 && (
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleCsvExport}>
               Tüm filtreyi CSV olarak indir
            </Button>
          </div>
        )}

        {/* Error — Sefa 18 May v68: Friendly mesaj + hint
            Sefa 21 May v68: Diagnostic endpoint link eklendi — kullanıcı
            tıklayınca tek istek ile root cause görür (auth/env/view). */}
        {error && (
          <Card padding="p-4" className="mb-5 !bg-kirmizi/5 ring-kirmizi/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0"></span>
              <div className="flex-1 text-[13px] text-kirmizi-koyu">
                <strong className="block mb-1">
                  Müşteri verisi şu an çekilemiyor
                </strong>
                <p className="text-gri-700 leading-relaxed">{error}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                     Yeniden dene
                  </button>
                  <a
                    href="/api/admin/customers/diagnostic"
                    target="_blank"
                    rel="noopener"
                    className="text-pim-mercan font-semibold hover:underline"
                    title="Hangi katmanda sorun var (auth/env/view) — JSON döner"
                  >
                     Root cause (diagnostic) →
                  </a>
                  <Link
                    href="/admin/audit-log"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    Audit log →
                  </Link>
                </div>
                <details className="mt-3 text-[11.5px] text-gri-700">
                  <summary className="cursor-pointer font-semibold">
                    Olası çözümler
                  </summary>
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    <li>
                      <strong>42P01</strong> → <code>v_admin_customers</code>{" "}
                      view yok, Migration 046 push edilmemiş
                    </li>
                    <li>
                      <strong>42501</strong> → permission denied, service role
                      key yanlış
                    </li>
                    <li>
                      <strong>generic 500</strong> → view stale (üst migration
                      şemayı değiştirdi)
                    </li>
                  </ul>
                </details>
              </div>
            </div>
          </Card>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton.OrderRow />
            <Skeleton.OrderRow />
            <Skeleton.OrderRow />
            <Skeleton.OrderRow />
          </div>
        ) : customers.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {search || segment !== "all"
                ? "Bu filtrede sonuç yok"
                : "Henüz kayıtlı müşteri yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {search || segment !== "all"
                ? "Filtreyi gevşet veya farklı bir arama dene."
                : "Kullanıcılar kayıt oldukça burada görünecek."}
            </p>
          </Card>
        ) : (
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === customers.length &&
                        customers.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="accent-pim-mercan w-4 h-4 cursor-pointer"
                      aria-label="Tümünü seç"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Müşteri
                  </th>
                  <th className="px-3 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Segment
                  </th>
                  <th className="px-3 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                    Sipariş
                  </th>
                  <th className="px-3 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                    Ciro
                  </th>
                  <th className="px-3 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Hesap
                  </th>
                  <th className="px-3 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Son hareket
                  </th>
                  <th className="px-3 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {customers.map((c) => {
                  const meta = SEGMENT_META[c.segment];
                  const detailHref = `/admin/musteriler/${c.user_id}`;
                  const isBanned =
                    c.banned_until &&
                    new Date(c.banned_until).getTime() > Date.now();
                  const lastActivity =
                    c.last_sign_in_at ?? c.last_order_at ?? c.registered_at;
                  return (
                    <tr
                      key={c.user_id}
                      className={cn(
                        "hover:bg-gri-50",
                        selectedIds.has(c.user_id) && "bg-pim-mercan-tint/20"
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.user_id)}
                          onChange={() => toggleSelect(c.user_id)}
                          className="accent-pim-mercan w-4 h-4 cursor-pointer"
                          aria-label={`${c.display_name ?? c.email} seç`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={detailHref}
                          className="font-semibold text-lacivert hover:text-pim-mercan"
                        >
                          {c.display_name ?? c.email.split("@")[0]}
                        </Link>
                        <div className="text-[12px] text-gri-500 flex items-center gap-1.5">
                          <span className="truncate max-w-[200px]">
                            {c.email}
                          </span>
                          {isBanned && (
                            <span className="inline-flex items-center h-[16px] px-1.5 rounded bg-kirmizi/10 text-kirmizi text-[10px] font-bold">
                               BAN
                            </span>
                          )}
                        </div>
                        {c.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center h-[18px] px-1.5 rounded bg-gri-100 text-gri-700 text-[10.5px] font-semibold"
                              >
                                {t}
                              </span>
                            ))}
                            {c.tags.length > 3 && (
                              <span className="text-[10.5px] text-gri-500">
                                +{c.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 h-[22px] px-2 rounded-full ring-1 text-[11px] font-bold",
                            meta.bg,
                            meta.color,
                            meta.ring
                          )}
                        >
                          {meta.dot && <StatusDot color={meta.dot} />}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className="font-semibold">{c.order_count}</span>
                        {c.active_orders > 0 && (
                          <span className="ml-1.5 inline-flex items-center h-[18px] px-1.5 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10px] font-bold">
                            {c.active_orders} aktif
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {fmt(c.total_revenue)} ₺
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center h-[20px] px-1.5 rounded text-[10.5px] font-bold",
                              c.email_confirmed_at
                                ? "bg-yesil-soft text-yesil"
                                : "bg-gri-100 text-gri-500"
                            )}
                            title={
                              c.email_confirmed_at
                                ? "Email doğrulanmış"
                                : "Email doğrulanmamış"
                            }
                          >
                             {c.email_confirmed_at ? "" : "—"}
                          </span>
                          {c.has_2fa && (
                            <span
                              className="inline-flex items-center h-[20px] px-1.5 rounded bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-bold"
                              title="2FA aktif"
                            >
                              
                            </span>
                          )}
                          {c.marketing_subscribed && (
                            <span
                              className="inline-flex items-center h-[20px] px-1.5 rounded bg-krem text-lacivert text-[10.5px] font-bold"
                              title="Pazarlama abonesi"
                            >
                              
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-gri-700">
                        {timeAgo(lastActivity)}
                        {c.last_order_id && (
                          <div className="text-[11px] text-gri-500 mt-0.5 font-mono">
                            {c.last_order_id}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={detailHref}
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-pim-mercan hover:underline"
                        >
                          Detay <Icon.ChevR size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Sprint 3: Bulk email modal */}
      {bulkEmailOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card padding="p-6" className="max-w-[600px] w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold">
                 Toplu email gönder ({selectedIds.size} alıcı)
              </h3>
              <button
                type="button"
                onClick={() => setBulkEmailOpen(false)}
                className="text-gri-500 hover:text-lacivert text-[18px]"
                aria-label="Kapat"
              >
                
              </button>
            </div>
            <div className="text-[12px] text-gri-700 mb-3 leading-relaxed">
              ℹ Her alıcıya ayrı email gider (Resend rate limit korunur).
              Toplu gönderim için cron 5 dk içinde işlemeye başlar.
              <strong> Spam koruması:</strong> max 100 alıcı / istek.
            </div>
            <input
              value={bulkSubject}
              onChange={(e) => setBulkSubject(e.target.value)}
              placeholder="Konu (2-120 karakter)"
              className="w-full px-3 h-11 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan mb-3"
            />
            <textarea
              value={bulkBody}
              onChange={(e) => setBulkBody(e.target.value)}
              rows={10}
              placeholder="Email içeriği... (10-4000 karakter, düz metin)"
              className="w-full px-3 py-2.5 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan resize-none"
            />
            <div className="mt-2 text-[11.5px] text-gri-500">
              {bulkBody.length} / 4000 karakter
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setBulkEmailOpen(false)}
                disabled={bulkSending}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleBulkEmail()}
                disabled={
                  bulkSending ||
                  bulkSubject.trim().length < 2 ||
                  bulkBody.trim().length < 10
                }
              >
                {bulkSending
                  ? "Gönderiliyor..."
                  : `${selectedIds.size} kişiye gönder`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
