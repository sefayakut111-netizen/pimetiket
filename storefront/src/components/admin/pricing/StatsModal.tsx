/**
 * StatsModal — operatör için iş emri istatistikleri.
 *
 * sticker-fiyatlama.html v0.3 — renderStatsModal() port'u.
 * Her PDF iş emri otomatik kayıt eder, bu modal aggregate gösterir.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listStats,
  aggregateStats,
  clearStats,
  topSizes,
  recentRecords,
  recentMonths,
  type StatRecord,
} from "@/lib/pricing-stats";

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

const fmt = (n: number, dec = 0) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const fmtMonth = (m: string): string => {
  const [year, mo] = m.split("-");
  const months = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  return `${months[parseInt(mo) - 1]} ${year}`;
};

export function StatsModal({ open, onClose }: StatsModalProps) {
  const toast = useToast();
  const [records, setRecords] = useState<StatRecord[]>([]);

  const refresh = useCallback(() => {
    setRecords(listStats());
  }, []);

  useEffect(() => {
    if (open) refresh();
    const handler = () => refresh();
    if (typeof window !== "undefined") {
      window.addEventListener("pim_stats_updated", handler);
      return () => window.removeEventListener("pim_stats_updated", handler);
    }
  }, [open, refresh]);

  if (!open) return null;

  const agg = aggregateStats(records);
  const isEmpty = records.length === 0;
  const top = topSizes(agg, 5);
  const recent = recentRecords(records, 5);
  const months = recentMonths(agg, 3);

  function handleClear() {
    if (
      !confirm(
        "Tüm hesaplama geçmişi silinecek (lot sayaçları korunur). Emin misin?"
      )
    )
      return;
    clearStats();
    refresh();
    toast.success("İstatistikler sıfırlandı");
  }

  function handleExportCSV() {
    if (isEmpty) {
      toast.error("İhraç edilecek veri yok");
      return;
    }
    const headers = [
      "lot",
      "tarih",
      "ürün",
      "mod",
      "kesim",
      "boyut",
      "talep_adet",
      "üretim_adet",
      "rulo",
      "m²",
      "fire_pct",
      "maliyet",
      "intended_kar",
      "actual_kar",
      "kdv",
      "toplam",
      "birim_fiyat",
      "tier_mult",
      "müşteri",
    ];
    const rows = records.map((r) => [
      r.lot,
      new Date(r.timestamp).toLocaleString("tr-TR"),
      r.product,
      r.mode,
      r.cut ?? "-",
      `${r.width}x${r.height}`,
      r.requestedQty,
      r.producedQty,
      r.rollsNeeded,
      r.totalM2.toFixed(3),
      r.wastePct.toFixed(1),
      Math.round(r.baseCost),
      Math.round(r.intendedProfit),
      Math.round(r.actualProfit),
      Math.round(r.vatAmount),
      Math.round(r.total),
      r.unitPrice.toFixed(4),
      r.tierMultiplier.toFixed(2),
      r.customerName ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((c) =>
            typeof c === "string" && (c.includes(",") || c.includes('"'))
              ? `"${c.replace(/"/g, '""')}"`
              : String(c)
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pim-istatistik-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV indirildi");
  }

  return (
    <div
      className="fixed inset-0 bg-lacivert/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gri-200 flex items-center justify-between bg-gri-50">
          <div>
            <h3 className="text-[18px] font-semibold tracking-tight">
              📊 Üretim İstatistikleri
            </h3>
            <p className="text-[12px] text-gri-700 mt-0.5">
              Tüm zamanların özeti — yerel kayıt ({records.length} kayıt)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-2 rounded-full text-gri-700 hover:bg-gri-200"
          >
            <Icon.X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEmpty ? (
            <div className="text-center py-16">
              <div className="text-[48px] opacity-30 mb-3">📊</div>
              <p className="text-[14px] text-gri-700 mb-1">
                Henüz kayıt yok.
              </p>
              <p className="text-[12px] text-gri-500">
                Bir hesap yap → &ldquo;📄 İş Emri PDF&rdquo; → kayıt buraya düşer.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Hero stat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <HeroStat
                  label="Toplam Üretilen"
                  value={fmt(agg.totalProduced)}
                  unit="adet"
                  subtitle={`${fmt(agg.totalRequested)} adet sipariş · +${fmt(agg.totalProduced - agg.totalRequested)} hediye`}
                  variant="hero"
                />
                <HeroStat
                  label="Toplam Ciro"
                  value={fmt(agg.totalRevenue)}
                  unit="TL"
                  subtitle={`Net Kar: ${fmt(agg.totalActualProfit)} TL · ${agg.count} sipariş`}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <HeroStat
                  label="Baskılan Toplam"
                  value={agg.totalM2.toFixed(2)}
                  unit="m²"
                  subtitle={`Ort. fire: %${agg.avgWaste.toFixed(1)}`}
                />
                <HeroStat
                  label="Mod Dağılımı"
                  value={`${agg.byMode.fason}/${agg.byMode.uretim}`}
                  unit="fason/üretim"
                  subtitle={`Sticker ${agg.byProduct.sticker} · Etiket ${agg.byProduct.etiket}`}
                />
                <HeroStat
                  label="Ortalama Birim"
                  value={fmt(agg.avgUnitPrice, 2)}
                  unit="TL/adet"
                  subtitle={`Tüm zamanlar`}
                />
              </div>

              {/* Aylık kırılım */}
              {months.length > 0 && (
                <div className="bg-gri-50 rounded-xl ring-1 ring-gri-200 overflow-hidden">
                  <div className="px-4 py-3 bg-krem text-[11px] font-bold uppercase tracking-[0.1em] text-gri-700 flex justify-between">
                    <span>Aylık Kırılım</span>
                    <span>Sipariş · m² · Ciro · Kar</span>
                  </div>
                  <div className="divide-y divide-gri-200">
                    {months.map((m) => (
                      <div
                        key={m.month}
                        className="px-4 py-3 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center text-[12.5px] tabular-nums"
                      >
                        <span className="font-semibold">
                          {fmtMonth(m.month)}
                        </span>
                        <span className="text-gri-700">{m.count} sipariş</span>
                        <span className="text-gri-700">
                          {m.m2.toFixed(2)} m²
                        </span>
                        <span className="font-semibold">
                          {fmt(m.revenue)} TL
                        </span>
                        <span className="font-bold text-yesil">
                          +{fmt(m.profit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top sizes */}
              {top.length > 0 && (
                <div className="bg-gri-50 rounded-xl ring-1 ring-gri-200 overflow-hidden">
                  <div className="px-4 py-3 bg-krem text-[11px] font-bold uppercase tracking-[0.1em] text-gri-700 flex justify-between">
                    <span>En Popüler Boyutlar</span>
                    <span>Sipariş Sayısı</span>
                  </div>
                  <div className="divide-y divide-gri-200">
                    {top.map((s) => (
                      <div
                        key={s.size}
                        className="px-4 py-2.5 grid grid-cols-[80px_1fr_auto] gap-3 items-center text-[12.5px] tabular-nums"
                      >
                        <span
                          className={cn(
                            "inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.04em] text-center",
                            s.product === "sticker"
                              ? "bg-pim-mercan-tint text-pim-mercan-koyu"
                              : "bg-krem-soft text-lacivert"
                          )}
                        >
                          {s.product}
                        </span>
                        <span className="font-semibold">{s.size} mm</span>
                        <span className="text-gri-700">
                          {s.count} sipariş
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent records */}
              <div className="bg-gri-50 rounded-xl ring-1 ring-gri-200 overflow-hidden">
                <div className="px-4 py-3 bg-krem text-[11px] font-bold uppercase tracking-[0.1em] text-gri-700 flex justify-between">
                  <span>Son Kayıtlar</span>
                  <span>Tutar</span>
                </div>
                <div className="divide-y divide-gri-200">
                  {recent.map((r) => {
                    const dt = new Date(r.timestamp);
                    return (
                      <div
                        key={r.lot}
                        className="px-4 py-2.5 grid grid-cols-[80px_1fr_auto] gap-3 items-center text-[12px] tabular-nums"
                      >
                        <span className="font-mono font-bold text-pim-mercan text-[11px]">
                          {r.lot}
                        </span>
                        <span className="text-gri-700 truncate">
                          {r.width}×{r.height}mm · {r.producedQty} adet ·{" "}
                          {r.product}
                          {" · "}
                          {dt.toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                        <span className="font-semibold">
                          {fmt(r.total)} TL
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gri-200 bg-gri-50 flex justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="text-[12px] text-gri-500 hover:text-kirmizi underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            Tüm verileri sıfırla
          </button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              disabled={isEmpty}
            >
              📥 CSV indir
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Hero stat
// ============================================================

function HeroStat({
  label,
  value,
  unit,
  subtitle,
  variant,
}: {
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  variant?: "hero";
}) {
  const isHero = variant === "hero";
  return (
    <div
      className={cn(
        "rounded-xl p-4 ring-1",
        isHero
          ? "bg-gradient-to-br from-lacivert to-lacivert-koyu text-white ring-transparent"
          : "bg-white ring-gri-200"
      )}
    >
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.12em] font-bold mb-1.5",
          isHero ? "text-white/50" : "text-gri-700"
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-bold tracking-tight tabular-nums leading-none",
          isHero ? "text-[32px]" : "text-[22px]"
        )}
      >
        {value}
        {unit && (
          <span
            className={cn(
              "ml-1.5 font-medium",
              isHero ? "text-white/50 text-[16px]" : "text-gri-500 text-[12px]"
            )}
          >
            {unit}
          </span>
        )}
      </div>
      {subtitle && (
        <div
          className={cn(
            "text-[11px] mt-1.5",
            isHero ? "text-white/50" : "text-gri-700"
          )}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
