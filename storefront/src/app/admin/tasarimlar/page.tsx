"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Pim } from "@/components/Pim";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AdminDesignRow } from "@/app/api/admin/designs/route";
import {
  isTestOrderLike,
} from "@/lib/admin-order-filters";
import {
  DESIGN_FILE_STATUS_FILTERS,
  DESIGN_FILE_STATUS_META,
  formatAiCheckSummary,
  type DesignFileStatusFilter,
} from "@/lib/design-file-status";

type StatusFilter = DesignFileStatusFilter;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function isTestDesign(d: AdminDesignRow): boolean {
  return isTestOrderLike({ id: d.orderId, customer: d.customerName });
}

export default function AdminTasarimlarPage() {
  const toast = useToast();
  const [allDesigns, setAllDesigns] = useState<AdminDesignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showTestDesigns, setShowTestDesigns] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const loadDesigns = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/admin/designs?limit=500")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{
          designs: AdminDesignRow[];
          total: number;
        }>;
      })
      .then((data) => {
        setAllDesigns(data.designs);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setAllDesigns([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void loadDesigns();
  }, [loadDesigns]);

  const visibleCatalog = useMemo(
    () =>
      showTestDesigns ? allDesigns : allDesigns.filter((d) => !isTestDesign(d)),
    [allDesigns, showTestDesigns]
  );

  const hiddenTestCount = useMemo(
    () => allDesigns.filter(isTestDesign).length,
    [allDesigns]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: visibleCatalog.length };
    for (const f of DESIGN_FILE_STATUS_FILTERS) {
      if (f.id === "all") continue;
      counts[f.id] = visibleCatalog.filter((d) => d.status === f.id).length;
    }
    return counts;
  }, [visibleCatalog]);

  const designs = useMemo(() => {
    if (filter === "all") return visibleCatalog;
    return visibleCatalog.filter((d) => d.status === filter);
  }, [visibleCatalog, filter]);

  const filtered = useMemo(() => {
    if (!search) return designs;
    const q = search.toLowerCase();
    return designs.filter(
      (d) =>
        d.orderId.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.originalName.toLowerCase().includes(q) ||
        (d.productTitle?.toLowerCase().includes(q) ?? false)
    );
  }, [designs, search]);

  const stuckAnalyzingCount = useMemo(
    () =>
      allDesigns.filter((d) => {
        if (d.status !== "analyzing") return false;
        const ageMs = Date.now() - new Date(d.uploadedAt).getTime();
        return ageMs > 60 * 60 * 1000;
      }).length,
    [allDesigns]
  );

  const qcDone = visibleCatalog.filter(
    (d) => d.status !== "uploaded" && d.status !== "approved"
  );
  const passRate =
    qcDone.length > 0
      ? (visibleCatalog.filter((d) => d.status === "qc_passed").length /
          qcDone.length) *
        100
      : 0;

  const repairStuck = async () => {
    if (repairing) return;
    setRepairing(true);
    try {
      const res = await fetch("/api/admin/designs/repair-stuck", {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        repaired?: number;
        ordersTriggered?: number;
        error?: string;
      };
      if (!json.ok) {
        toast.error(json.error ?? "Onarım başarısız");
        return;
      }
      toast.success(
        `${json.repaired ?? 0} dosya yeniden kuyruğa alındı (${json.ordersTriggered ?? 0} sipariş)`
      );
      await loadDesigns();
    } catch {
      toast.error("Onarım isteği gönderilemedi");
    } finally {
      setRepairing(false);
    }
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1320px] px-6">
        <div className="mb-6">
          <Eyebrow>Kütüphane</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Tasarımlar
          </h1>
          <p className="mt-2 text-xs text-gri-500">
            Tasarım dosyaları teslimden 90 gün sonra otomatik imha edilir
            (KVKK m.7).
          </p>
          {loading ? (
            <div className="mt-2 h-5 w-[220px] rounded bg-gri-100 animate-pulse" />
          ) : (
            <p className="mt-1.5 text-base text-gri-700">
              {visibleCatalog.length} aktif tasarım dosyası ·{" "}
              {qcDone.length > 0
                ? `AI oranı: %${passRate.toFixed(0)}`
                : "AI kontrolü bekliyor"}
            </p>
          )}
        </div>

        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2 items-center">
            {DESIGN_FILE_STATUS_FILTERS.map((f) => (
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
                {f.label} ({statusCounts[f.id] ?? 0})
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {stuckAnalyzingCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={repairing}
                  onClick={() => void repairStuck()}
                >
                  {repairing
                    ? "Isleniyor…"
                    : `Takili dosyalari yeniden isle (${stuckAnalyzingCount})`}
                </Button>
              )}
              <label className="flex items-center gap-2 text-[13px] text-gri-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTestDesigns}
                  onChange={(e) => setShowTestDesigns(e.target.checked)}
                  className="rounded border-gri-300 text-pim-mercan focus:ring-pim-mercan"
                />
                Test dosyalarini goster
                {hiddenTestCount > 0 && !showTestDesigns && (
                  <span className="text-gri-500">({hiddenTestCount} gizli)</span>
                )}
              </label>
              <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Siparis, musteri, dosya ara…"
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

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-gri-100 h-[76px] animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <Card padding="p-10" className="text-center">
            <Icon.Info size={32} className="text-kirmizi mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Liste yuklenemedi</h3>
            <p className="text-[13px] text-gri-700 mt-1">{error}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {designs.length === 0
                ? "Henuz tasarim yok"
                : "Bu aramada sonuc yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {designs.length === 0
                ? "Musteriler dosya yukledikce burada gorunecek."
                : "Filtreyi gevset veya aramayi temizle."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const meta =
                d.status in DESIGN_FILE_STATUS_META
                  ? DESIGN_FILE_STATUS_META[
                      d.status as keyof typeof DESIGN_FILE_STATUS_META
                    ]
                  : {
                      label: d.status,
                      color: "text-gri-700",
                      bg: "bg-gri-100",
                    };
              const aiSummary = formatAiCheckSummary(d.status, d.aiCheckFlags);
              const isImage = d.mimeType.startsWith("image/");
              return (
                <Link
                  key={d.id}
                  href={`/admin/siparisler/${d.orderId}`}
                  className="group flex items-center gap-3 rounded-xl bg-white ring-1 ring-gri-200 hover:ring-pim-mercan hover:bg-gri-50 transition-colors p-2.5"
                >
                  <div className="relative w-16 h-14 rounded-lg bg-gri-50 overflow-hidden grid place-items-center shrink-0">
                    {d.previewUrl && isImage ? (
                      <Image
                        src={d.previewUrl}
                        alt={d.originalName}
                        fill
                        sizes="64px"
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gri-500">
                        <Icon.Doc size={20} />
                        <span className="text-[8.5px] uppercase tracking-[0.04em] font-bold mt-0.5">
                          {d.mimeType.split("/")[1]?.slice(0, 4) || "dsy"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-[13px] font-semibold text-lacivert truncate group-hover:text-pim-mercan max-w-[220px] md:max-w-[300px]"
                        title={d.originalName}
                      >
                        {d.originalName}
                      </span>
                      <span className="text-[11px] text-gri-500 truncate">
                        · {d.customerName}
                      </span>
                    </div>
                    <div className="text-[11px] text-gri-700 mt-0.5 truncate flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{d.orderId}</span>
                      {d.productConfig && (
                        <>
                          <span className="text-gri-400">·</span>
                          <span className="text-gri-700">{d.productConfig}</span>
                        </>
                      )}
                    </div>
                    {aiSummary && (
                      <p
                        className={cn(
                          "text-[11px] mt-0.5 truncate max-w-[480px]",
                          d.status === "qc_passed" || d.status === "approved"
                            ? "text-yesil"
                            : d.status === "qc_failed"
                              ? "text-kirmizi"
                              : "text-sari-koyu"
                        )}
                        title={aiSummary}
                      >
                        {d.status === "qc_passed" || d.status === "approved"
                          ? `AI · ${aiSummary}`
                          : aiSummary}
                      </p>
                    )}
                  </div>

                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap",
                        meta.bg,
                        meta.color
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-gri-700 tabular-nums w-[60px] text-right">
                      {formatSize(d.sizeBytes)}
                    </span>
                    <span className="text-[11px] text-gri-500 tabular-nums w-[100px] text-right">
                      {formatDate(d.uploadedAt)}
                      <span className="ml-1 text-gri-400">v{d.version}</span>
                    </span>
                    <Icon.ChevR
                      size={12}
                      className="text-gri-400 group-hover:text-pim-mercan"
                    />
                  </div>

                  <div className="md:hidden flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center h-[20px] px-2 rounded-full text-[10px] font-bold",
                        meta.bg,
                        meta.color
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10.5px] text-gri-500 tabular-nums">
                      {formatSize(d.sizeBytes)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
