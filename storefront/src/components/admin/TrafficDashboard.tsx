"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow } from "@/components/ui";
import { LineChart, BarChart } from "@/components/charts";
import type { LinePoint, BarPoint } from "@/components/charts";
import { cn } from "@/lib/cn";
import type {
  TrafficRange,
  TrafficSummary,
  TrafficNotConfigured,
} from "@/lib/analytics/ga4-data-api";

type TrafficResponse = TrafficSummary | TrafficNotConfigured;

const RANGE_OPTIONS: { value: TrafficRange; label: string }[] = [
  { value: "7d", label: "7 gün" },
  { value: "28d", label: "28 gün" },
  { value: "90d", label: "90 gün" },
];

function formatCount(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} sn`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m} dk ${s} sn` : `${m} dk`;
}

function formatPercent(rate: number): string {
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(1)}%`;
}

function SetupCard({ reason }: { reason?: string }) {
  return (
    <Card className="max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Icon.Info size={20} />
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Trafik kurulumu gerekli
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {reason ??
                "GA4 ve Data API ortam değişkenleri tanımlı değil. Aşağıdaki adımları tamamlayın; veri akışı başladıktan sonra bu sayfa otomatik dolar."}
            </p>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
            <li>
              <strong>Veri toplama (Vercel env):</strong>{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXX
              </code>{" "}
              — analytics.google.com&apos;da property açıp Measurement ID alın.
            </li>
            <li>
              <strong>PostHog (opsiyonel):</strong>{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_POSTHOG_KEY
              </code>{" "}
              +{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_POSTHOG_HOST
              </code>
            </li>
            <li>
              <strong>Admin panel (Data API):</strong> Google Cloud service
              account → GA4 property&apos;ye Viewer → Vercel env:
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                    GA4_PROPERTY_ID
                  </code>
                </li>
                <li>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                    GA4_SA_CLIENT_EMAIL
                  </code>
                </li>
                <li>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                    GA4_SA_PRIVATE_KEY
                  </code>{" "}
                  (PEM, satır sonları <code>\n</code>)
                </li>
              </ul>
            </li>
          </ol>
          <p className="text-xs text-gray-500">
            Vercel Analytics + Speed Insights ek ayar gerektirmez. GA4 panelinde
            veri 24–48 saat içinde görünür.
          </p>
        </div>
      </div>
    </Card>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
}

function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <Card padding="p-4">
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
    </Card>
  );
}

export function TrafficDashboard() {
  const [range, setRange] = useState<TrafficRange>("28d");
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: TrafficRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/traffic?range=${r}`, {
        credentials: "include",
      });
      if (res.status === 403) {
        setError("Bu sayfaya erişim yetkiniz yok.");
        setData(null);
        return;
      }
      if (!res.ok) {
        setError("Trafik verisi yüklenemedi.");
        setData(null);
        return;
      }
      const json = (await res.json()) as TrafficResponse;
      setData(json);
    } catch {
      setError("Bağlantı hatası.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const chartPoints: LinePoint[] = useMemo(() => {
    if (!data || !data.configured) return [];
    return data.byDay.map((d) => ({ x: d.date, y: d.sessions }));
  }, [data]);

  const sourceBars: BarPoint[] = useMemo(() => {
    if (!data || !data.configured) return [];
    return data.sources.slice(0, 8).map((s) => ({
      label: s.source.length > 18 ? `${s.source.slice(0, 16)}…` : s.source,
      value: s.sessions,
    }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon.Refresh size={16} className="animate-spin" />
        Trafik verisi yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg border-red-100 bg-red-50/50">
        <p className="text-sm text-red-800">{error}</p>
      </Card>
    );
  }

  if (!data || !data.configured) {
    return <SetupCard reason={data?.configured === false ? data.reason : undefined} />;
  }

  const { totals, topPages } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Google Analytics 4 — son{" "}
          {RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range}
        </p>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range === opt.value
                  ? "bg-pim-mercan text-white"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Aktif kullanıcı" value={formatCount(totals.activeUsers)} />
        <KpiCard label="Oturum" value={formatCount(totals.sessions)} />
        <KpiCard
          label="Sayfa görüntüleme"
          value={formatCount(totals.pageViews)}
        />
        <KpiCard
          label="Ort. oturum süresi"
          value={formatDuration(totals.avgSessionSec)}
        />
        <KpiCard
          label="Bounce rate"
          value={formatPercent(totals.bounceRate)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Eyebrow>Günlük oturumlar</Eyebrow>
          <div className="mt-4">
            <LineChart
              points={chartPoints}
              height={160}
              formatY={formatCount}
              emptyLabel="Bu dönemde oturum yok"
            />
          </div>
        </Card>

        <Card>
          <Eyebrow>Trafik kaynakları</Eyebrow>
          <div className="mt-4">
            <BarChart
              bars={sourceBars}
              height={160}
              formatY={formatCount}
              emptyLabel="Kaynak verisi yok"
            />
          </div>
        </Card>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <Eyebrow>En çok görüntülenen sayfalar</Eyebrow>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Sayfa</th>
                <th className="px-5 py-3 text-right">Görüntüleme</th>
              </tr>
            </thead>
            <tbody>
              {topPages.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-gray-500">
                    Sayfa verisi yok
                  </td>
                </tr>
              ) : (
                topPages.map((row) => (
                  <tr
                    key={row.path}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="max-w-md truncate px-5 py-3 font-mono text-xs text-gray-800">
                      {row.path}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-900">
                      {formatCount(row.views)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => void load(range)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
      >
        <Icon.Refresh size={14} className={loading ? "animate-spin" : undefined} />
        Yenile
      </button>
    </div>
  );
}
