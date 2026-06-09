"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow, Skeleton, Button } from "@/components/ui";
import { AdminFetchErrorBanner } from "@/components/admin/AdminFetchErrorBanner";
import { cn } from "@/lib/cn";
import { lcpStatus } from "@/lib/perf-baseline";
import type {
  AutomationFlag,
  AutomationFlagStatus,
  SystemOverviewPayload,
} from "@/lib/system-overview";

const FLAG_STYLES: Record<AutomationFlagStatus, string> = {
  active: "bg-yesil-soft/40 text-yesil ring-yesil/30",
  partial: "bg-saman/15 text-saman-koyu ring-saman/30",
  inactive: "bg-gri-100 text-gri-600 ring-gri-200",
  cancelled: "bg-gri-100 text-gri-500 ring-gri-200 line-through",
};

const FLAG_LABELS: Record<AutomationFlagStatus, string> = {
  active: "Aktif",
  partial: "Kısmi",
  inactive: "Kapalı",
  cancelled: "İptal",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <Card
      padding="p-4"
      className={cn(
        "h-full",
        accent && "ring-kirmizi/25 !bg-kirmizi/5",
        href && "hover:ring-pim-mercan/30 transition-shadow"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-500">
        {label}
      </p>
      <p
        className={cn(
          "text-[26px] font-bold tabular-nums mt-1",
          accent ? "text-kirmizi" : "text-lacivert"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[12px] text-gri-600 mt-0.5 leading-snug">{sub}</p>
      )}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

function AutomationCard({ flag }: { flag: AutomationFlag }) {
  return (
    <Card padding="p-4" className="h-full">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[13.5px] font-semibold text-lacivert leading-snug">
          {flag.label}
        </h3>
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ring-1",
            FLAG_STYLES[flag.status]
          )}
        >
          {FLAG_LABELS[flag.status]}
        </span>
      </div>
      <p className="text-[12.5px] text-gri-700 leading-relaxed">{flag.detail}</p>
      {flag.activationStep && (
        <p className="text-[11.5px] text-saman-koyu mt-2 font-medium">
          → {flag.activationStep}
        </p>
      )}
      {flag.href && (
        <Link
          href={flag.href}
          className="inline-block mt-2 text-[12px] text-pim-mercan font-semibold hover:underline"
        >
          Detay sayfası
        </Link>
      )}
    </Card>
  );
}

export default function AdminSistemPerformansPage() {
  const [data, setData] = useState<SystemOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-overview", { cache: "no-store" });
      const json = (await res.json()) as
        | SystemOverviewPayload
        | { ok: false; error?: string };
      if (!res.ok || !("generatedAt" in json)) {
        throw new Error(
          "error" in json ? (json.error ?? "overview_fetch_failed") : "overview_fetch_failed"
        );
      }
      setData(json);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sistem özeti yüklenemedi"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <Eyebrow>Teknik performans & otomasyon</Eyebrow>
          <h1 className="text-[22px] font-bold text-lacivert mt-1">
            Sistem merkezi
          </h1>
          <p className="text-[13px] text-gri-600 mt-1 max-w-xl leading-relaxed">
            Cron sağlığı, denetçiler, operasyon kuyruğu, otomasyon flag&apos;leri
            ve Core Web Vitals baseline — tek bakış.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Yenile
        </Button>
      </div>

      {error && (
        <AdminFetchErrorBanner
          title="Sistem özeti yüklenemedi"
          message={error}
          onRetry={() => void load()}
          className="mb-6"
        />
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <KpiCard
              label="Cron hata (son run)"
              value={data.kpis.cronErrors}
              sub={`${data.kpis.cronTotal} job kayıtlı · 24sa: ${data.kpis.cronFailures24h} fail`}
              accent={data.kpis.cronErrors > 0}
              href="/admin/sistem/cronlar"
            />
            <KpiCard
              label="Denetçi onay bekleyen"
              value={data.kpis.auditorsPendingTotal}
              sub={
                data.kpis.auditorsPendingCritical > 0
                  ? `${data.kpis.auditorsPendingCritical} kritik`
                  : "Kritik yok"
              }
              accent={data.kpis.auditorsPendingCritical > 0}
              href="/admin/denetciler/bekleyen"
            />
            <KpiCard
              label="Kuyruk kritik"
              value={data.kpis.queueCritical}
              sub="Prova SLA + AI QC acil"
              accent={data.kpis.queueCritical > 0}
              href="/admin/kuyruk"
            />
            <KpiCard
              label="Mail kuyruk"
              value={data.kpis.mailPending}
              sub={
                data.kpis.mailStubMode
                  ? "Stub mod — gönderim kapalı"
                  : "Canlı gönderim"
              }
              accent={data.kpis.mailStubMode && data.kpis.mailPending > 0}
              href="/admin/mail-health"
            />
          </div>

          <section className="mb-8">
            <h2 className="text-[15px] font-semibold text-lacivert mb-3">
              Denetçi özeti
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {(["appHealth", "seo"] as const).map((key) => {
                const snap = data.auditors[key];
                const title =
                  key === "appHealth" ? "Uygulama sağlığı" : "SEO / Performance";
                return (
                  <Card key={key} padding="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-[13.5px] font-semibold">{title}</h3>
                      <Link
                        href={`/admin/denetciler/${key === "appHealth" ? "app_health" : "seo"}`}
                        className="text-[12px] text-pim-mercan font-semibold hover:underline shrink-0"
                      >
                        Detay
                      </Link>
                    </div>
                    {snap ? (
                      <>
                        <p className="text-[12px] text-gri-600 mt-2">
                          Son çalışma: {timeAgo(snap.startedAt)} ·{" "}
                          {snap.criticalCount} kritik, {snap.warningCount} uyarı
                        </p>
                        <p className="text-[12.5px] text-gri-700 mt-1 leading-relaxed">
                          {snap.summary ?? "Özet yok"}
                        </p>
                      </>
                    ) : (
                      <p className="text-[12.5px] text-gri-500 mt-2">
                        Henüz çalıştırılmamış
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-[15px] font-semibold text-lacivert">
                Otomasyon durumu
              </h2>
              <p className="text-[12px] text-gri-500">
                Aktivasyon sırası: Resend → Yurtıçi → fason auto-assign
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.automation.map((flag) => (
                <AutomationCard key={flag.id} flag={flag} />
              ))}
            </div>
          </section>

          <section className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-[15px] font-semibold text-lacivert">
                Core Web Vitals (baseline)
              </h2>
              <div className="flex flex-wrap gap-2">
                <a
                  href={data.cwv.vercelSpeedInsightsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-pim-mercan font-semibold hover:underline"
                >
                  Vercel Speed Insights
                </a>
                <span className="text-gri-300">·</span>
                <span className="text-[12px] text-gri-500">
                  Ölçüm:{" "}
                  {new Date(data.cwv.baselineMeasuredAt).toLocaleDateString(
                    "tr-TR"
                  )}
                </span>
              </div>
            </div>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-gri-50 text-left text-gri-600">
                      <th className="px-4 py-2.5 font-semibold">Sayfa</th>
                      <th className="px-4 py-2.5 font-semibold">Perf</th>
                      <th className="px-4 py-2.5 font-semibold">LCP</th>
                      <th className="px-4 py-2.5 font-semibold">TBT</th>
                      <th className="px-4 py-2.5 font-semibold">PSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cwv.entries.map((row, i) => {
                      const lcp = lcpStatus(row.lcpSec);
                      return (
                        <tr
                          key={row.path}
                          className={cn(
                            "border-t border-gri-100",
                            i % 2 === 0 && "bg-white"
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium text-lacivert">
                            {row.label}
                            <span className="text-gri-500 font-normal ml-1">
                              {row.path}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{row.perfScore}</td>
                          <td
                            className={cn(
                              "px-4 py-2.5 tabular-nums font-medium",
                              lcp === "poor" && "text-kirmizi",
                              lcp === "needs_improvement" && "text-saman-koyu",
                              lcp === "good" && "text-yesil"
                            )}
                          >
                            {row.lcpSec}s
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{row.tbtMs}ms</td>
                          <td className="px-4 py-2.5">
                            <a
                              href={
                                data.cwv.psiUrls.find((p) => p.path === row.path)
                                  ?.url ?? "#"
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pim-mercan font-semibold hover:underline"
                            >
                              Test et
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-3 text-[11.5px] text-gri-500 border-t border-gri-100">
                Hedef: LCP &lt; {data.cwv.targets.lcpSecYellow}s (sarı), perf skoru{" "}
                {data.cwv.targets.perfScoreGoal}+. Canlı CWV Vercel Speed Insights
                (analytics izni sonrası) ile toplanır.
              </p>
            </Card>
          </section>

          <section className="mb-8">
            <h2 className="text-[15px] font-semibold text-lacivert mb-3">
              Ortam değişkenleri
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.env.map((e) => (
                <span
                  key={e.key}
                  className={cn(
                    "text-[11.5px] font-medium px-2.5 py-1 rounded-full ring-1",
                    e.configured
                      ? "bg-yesil-soft/30 text-yesil ring-yesil/25"
                      : "bg-gri-100 text-gri-600 ring-gri-200"
                  )}
                  title={e.key}
                >
                  {e.label}: {e.configured ? "✓" : "eksik"}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-lacivert mb-3">
              Hızlı linkler
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg bg-gri-50 text-lacivert hover:bg-gri-100 ring-1 ring-gri-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
