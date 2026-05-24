/**
 * Pim Etiket — /admin/tasarimlar
 *
 * Tasarım kütüphanesi — admin/staff için tüm müşteri yüklemeleri.
 *
 * İçerik:
 *   - Status filtreleri (uploaded / analyzing / qc_* / approved)
 *   - Grid: 4 sütun thumbnail kart
 *   - Her kart: önizleme, müşteri, sipariş, ürün, AI flag rozeti, tarih
 *   - Karta tıklayınca sipariş detayına gider
 *   - Search: orderId / müşteri / dosya adı
 *
 * Veri kaynağı: GET /api/admin/designs (RLS: admin/staff role)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Pim } from "@/components/Pim";
import { Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AdminDesignRow } from "@/app/api/admin/designs/route";
import {
  DESIGN_FILE_STATUS_FILTERS,
  DESIGN_FILE_STATUS_META,
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

export default function AdminTasarimlarPage() {
  const [designs, setDesigns] = useState<AdminDesignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url =
      filter === "all"
        ? "/api/admin/designs"
        : `/api/admin/designs?status=${filter}`;
    setLoading(true);
    setError(null);
    fetch(url)
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
        if (cancelled) return;
        setDesigns(data.designs);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setDesigns([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

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

  // KPI: AI ✓ ratio (qc_passed / total qc_*)
  const qcDone = designs.filter(
    (d) => d.status !== "uploaded" && d.status !== "approved"
  );
  const passRate =
    qcDone.length > 0
      ? (designs.filter((d) => d.status === "qc_passed").length /
          qcDone.length) *
        100
      : 0;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1320px] px-6">
        {/* Header */}
        <div className="mb-6">
          <Eyebrow>Kütüphane</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Tasarımlar
          </h1>
          {/* Sefa 21 May v68 (site denetim P1 #6): loading sırasında
              "0 aktif tasarım" flash etmesin → skeleton göster */}
          {loading ? (
            <div className="mt-2 h-5 w-[220px] rounded bg-gri-100 animate-pulse" />
          ) : (
            <p className="mt-1.5 text-base text-gri-700">
              {designs.length} aktif tasarım dosyası ·{" "}
              {qcDone.length > 0
                ? `AI ✓ oranı: %${passRate.toFixed(0)}`
                : "AI kontrolü bekliyor"}
            </p>
          )}
        </div>

        {/* Filtre + arama */}
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
                {f.label}
              </button>
            ))}
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px] relative">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sipariş, müşteri, dosya ara…"
                className="!h-11 !pl-10"
              />
              <Icon.Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
              />
            </div>
          </div>
        </Card>

        {/* Sonuç — Sefa 20 May v68: grid → yatay satır liste (15+ tasarımda
            kalabalıkı önler, lineer scan kolaylığı). Mobile 2 satıra düşer. */}
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
            <h3 className="text-lg font-semibold">Liste yüklenemedi</h3>
            <p className="text-[13px] text-gri-700 mt-1">{error}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {designs.length === 0
                ? "Henüz tasarım yok"
                : "Bu aramada sonuç yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {designs.length === 0
                ? "Müşteriler dosya yükledikçe burada görünecek."
                : "Filtreyi gevşet veya aramayı temizle."}
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
              const errFlags = d.aiCheckFlags.filter(
                (f) => f.kind === "error"
              ).length;
              const warnFlags = d.aiCheckFlags.filter(
                (f) => f.kind === "warning"
              ).length;
              const isImage = d.mimeType.startsWith("image/");
              return (
                <Link
                  key={d.id}
                  href={`/admin/siparisler/${d.orderId}`}
                  className="group flex items-center gap-3 rounded-xl bg-white ring-1 ring-gri-200 hover:ring-pim-mercan hover:bg-gri-50 transition-colors p-2.5"
                >
                  {/* Thumbnail 64×56 */}
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

                  {/* Orta blok — dosya + müşteri + sipariş + config */}
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
                  </div>

                  {/* Sağ blok — status + flags + boyut + tarih (md+: yan yana,
                      mobile: ikinci satıra düşer) */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    {/* Flag rozetleri */}
                    {errFlags > 0 && (
                      <span
                        className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-kirmizi text-white text-[10px] font-bold"
                        title={`${errFlags} hata`}
                      >
                        ✕ {errFlags}
                      </span>
                    )}
                    {warnFlags > 0 && (
                      <span
                        className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-sari text-white text-[10px] font-bold"
                        title={`${warnFlags} uyarı`}
                      >
                        ! {warnFlags}
                      </span>
                    )}
                    {/* Status */}
                    <span
                      className={cn(
                        "inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap",
                        meta.bg,
                        meta.color
                      )}
                    >
                      {meta.label}
                    </span>
                    {/* Boyut */}
                    <span className="text-[11px] text-gri-700 tabular-nums w-[60px] text-right">
                      {formatSize(d.sizeBytes)}
                    </span>
                    {/* Tarih + version */}
                    <span className="text-[11px] text-gri-500 tabular-nums w-[100px] text-right">
                      {formatDate(d.uploadedAt)}
                      <span className="ml-1 text-gri-400">v{d.version}</span>
                    </span>
                    <Icon.ChevR size={12} className="text-gri-400 group-hover:text-pim-mercan" />
                  </div>

                  {/* Mobile sağ blok — sadece status + tarih kısaca */}
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
