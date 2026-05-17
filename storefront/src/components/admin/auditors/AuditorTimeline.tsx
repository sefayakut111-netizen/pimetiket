/**
 * AuditorTimeline — Son denetim run'larını dikey timeline olarak gösterir.
 *
 * Sefa 17 May: "/admin/denetciler dashboard'a timeline ekle, akışı görmek
 * istiyorum". Önceden plana yazılmıştı (Adım 8) — eklenmiş hali.
 *
 * Veri kaynağı: /api/admin/auditors/runs?limit=20 (son 20 run, kronolojik)
 *
 * Görüntü:
 *   ╔══════════════════════════════════════════════╗
 *   ║ 🔒 Güvenlik         · 2 dk önce  · ✓ Temiz   ║
 *   ║ 💰 Finans           · 1 sa önce  · ⚠ 2 uyarı ║
 *   ║ 🛒 Workflow         · 3 sa önce  · ✗ 1 krit. ║
 *   ║ ...                                          ║
 *   ╚══════════════════════════════════════════════╝
 *
 * Her satır tıklanırsa /admin/denetciler/[auditor] detay sayfasına gider.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorName,
  type AuditorRunRow,
} from "@/lib/agents/_shared/types";

interface Props {
  limit?: number;
  /** Sadece son N saat içindeki run'ları göster */
  hoursWindow?: number;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

function statusBadge(run: Partial<AuditorRunRow>): {
  icon: string;
  label: string;
  cls: string;
} {
  if (run.status === "failed") {
    return {
      icon: "⛔",
      label: "Hata",
      cls: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
    };
  }
  const critical = run.critical_count ?? 0;
  const warning = run.warning_count ?? 0;
  if (critical > 0) {
    return {
      icon: "✗",
      label: `${critical} kritik`,
      cls: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
    };
  }
  if (warning > 0) {
    return {
      icon: "⚠",
      label: `${warning} uyarı`,
      cls: "bg-saman/15 text-saman-koyu ring-saman/30",
    };
  }
  return {
    icon: "✓",
    label: "Temiz",
    cls: "bg-yesil-soft/40 text-yesil ring-yesil/30",
  };
}

export function AuditorTimeline({ limit = 20, hoursWindow }: Props) {
  const [runs, setRuns] = useState<Partial<AuditorRunRow>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: String(limit) });
    if (hoursWindow) {
      const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
      params.set("since", since.toISOString());
    }
    fetch(`/api/admin/auditors/runs?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; runs?: Partial<AuditorRunRow>[]; error?: string }) => {
        if (cancelled) return;
        if (!j.ok || !j.runs) {
          setError(j.error ?? "fetch_failed");
        } else {
          setRuns(j.runs);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "network");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, hoursWindow]);

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[60px] rounded-xl bg-gri-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-kirmizi/5 ring-1 ring-kirmizi/20 p-4 text-[13px] text-kirmizi">
        Timeline yüklenemedi: {error}
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-xl bg-gri-50 ring-1 ring-gri-200 p-6 text-center">
        <div className="text-[28px] mb-2">⏳</div>
        <div className="font-semibold text-[14px] text-lacivert">
          Henüz hiç çalışma yok
        </div>
        <div className="text-[12.5px] text-gri-700 mt-1">
          "▶ Tümünü çalıştır" butonuna basabilir ya da cron schedule'ı
          beklersin (her gün otomatik çalışır).
        </div>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {/* Dikey çizgi */}
      <span
        aria-hidden
        className="absolute left-[18px] top-3 bottom-3 w-px bg-gri-200"
      />
      {runs.map((run, idx) => {
        const badge = statusBadge(run);
        const name = run.auditor_name as AuditorName;
        const emoji = AUDITOR_EMOJI[name] ?? "❓";
        const label = AUDITOR_LABELS[name] ?? name;
        const findings = run.findings_count ?? 0;
        const isLast = idx === runs.length - 1;
        return (
          <li
            key={run.id ?? `${run.auditor_name}-${run.started_at}-${idx}`}
            className={cn("relative pl-12", !isLast && "pb-3")}
          >
            {/* Nokta */}
            <span
              aria-hidden
              className={cn(
                "absolute left-2.5 top-3.5 w-3 h-3 rounded-full ring-2 ring-white",
                run.critical_count && run.critical_count > 0
                  ? "bg-kirmizi"
                  : run.warning_count && run.warning_count > 0
                    ? "bg-saman"
                    : "bg-yesil"
              )}
            />
            <Link
              href={`/admin/denetciler/${run.auditor_name}`}
              className={cn(
                "block rounded-xl bg-white ring-1 ring-gri-200 p-3.5",
                "hover:ring-pim-mercan hover:-translate-y-0.5 transition-all"
              )}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[20px] shrink-0">{emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[13.5px] text-lacivert truncate">
                      {label}
                    </div>
                    <div className="text-[11.5px] text-gri-500 mt-0.5">
                      {timeAgo(run.started_at ?? null)}
                      {findings > 0 && ` · ${findings} bulgu`}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 h-[22px] px-2 rounded-full ring-1 text-[11px] font-bold shrink-0",
                    badge.cls
                  )}
                >
                  {badge.icon} {badge.label}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
