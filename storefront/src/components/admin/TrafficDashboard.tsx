"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow } from "@/components/ui";
import { LineChart, BarChart } from "@/components/charts";
import type { LinePoint, BarPoint } from "@/components/charts";
import { cn } from "@/lib/cn";
import type {
  TrafficRange,
  TrafficSummary,
  TrafficNotConfigured,
  Ga4SetupStatus,
  RealtimeSummary,
  RealtimeNotConfigured,
} from "@/lib/analytics/ga4-data-api";
import type { GscPerformanceSummary } from "@/lib/seo/gsc-performance";

type TrafficResponse = TrafficSummary | TrafficNotConfigured;
type RealtimeResponse = RealtimeSummary | RealtimeNotConfigured;

const RANGE_OPTIONS: { value: TrafficRange; label: string }[] = [
  { value: "24h", label: "24 saat" },
  { value: "7d", label: "7 gün" },
  { value: "28d", label: "28 gün" },
  { value: "90d", label: "90 gün" },
];

const RANGE_SUBTITLE: Record<TrafficRange, string> = {
  "24h": "son 24 saat (bugün)",
  "7d": "son 7 gün",
  "28d": "son 28 gün",
  "90d": "son 90 gün",
};

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

function TrafficLinksCard({
  setup,
  variant,
}: {
  setup?: Ga4SetupStatus;
  variant: "no_access" | "error";
}) {
  return (
    <div className="space-y-4">
      {setup?.measurementIdSet && (
        <Card className="border-yesil/30 bg-yesil-soft/20">
          <div className="flex items-start gap-3">
            <span className="text-yesil text-lg leading-none">✓</span>
            <div>
              <p className="text-sm font-semibold text-lacivert">
                Site trafiği toplanıyor
              </p>
              <p className="mt-1 text-sm text-gri-700">
                Measurement ID{" "}
                <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">
                  {setup.measurementId}
                </code>{" "}
                canlı sitede aktif. Ziyaretçi verisi toplanıyor.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="https://analytics.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <Card className="h-full transition hover:border-pim-mercan-koyu/40 hover:shadow-sm">
            <Eyebrow>Google Analytics 4</Eyebrow>
            <p className="mt-2 text-sm text-gri-700">
              Gerçek zamanlı ziyaretçi, oturum, dönüşüm ve kaynak analizi.
            </p>
            <span className="mt-3 inline-flex text-sm font-semibold text-pim-mercan-koyu group-hover:underline">
              GA4 panelini aç →
            </span>
          </Card>
        </a>

        <a
          href="https://eu.posthog.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <Card className="h-full transition hover:border-pim-mercan-koyu/40 hover:shadow-sm">
            <Eyebrow>PostHog</Eyebrow>
            <p className="mt-2 text-sm text-gri-700">
              Funnel, session replay, event analizi ve davranış haritası.
            </p>
            <span className="mt-3 inline-flex text-sm font-semibold text-pim-mercan-koyu group-hover:underline">
              PostHog panelini aç →
            </span>
          </Card>
        </a>
      </div>

      {variant === "no_access" && (
        <details className="rounded-lg border border-gri-200 bg-gri-50 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-gri-700">
            Bu sayfada gömülü dashboard&apos;ı göstermek ister misin?
          </summary>
          <div className="mt-3 space-y-2 text-gri-700">
            <p>
              Gömülü kartlar için Google Analytics&apos;te servis hesabına{" "}
              <strong>Görüntüleyici (Viewer)</strong> yetkisi vermelisin:
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-xs">
              <li>analytics.google.com → Yönetici → Mülk erişim yönetimi</li>
              <li>
                <strong>+</strong> → Kullanıcı ekle →{" "}
                <code className="rounded bg-white px-1 text-[11px]">
                  GA4_SA_CLIENT_EMAIL
                </code>{" "}
                (servis hesabı e-postası)
              </li>
              <li>Bildirim tikini kapat → Görüntüleyici → Ekle</li>
              <li>Erişim 24-48 saat içinde aktif olur; sayfa otomatik dolar.</li>
            </ol>
            <p className="text-xs text-gri-500">
              Reklam engelleyici uzantılar GA4 ekleme akışını bozabilir —
              gerekirse gizli sekmede dene.
            </p>
          </div>
        </details>
      )}

      {variant === "error" && (
        <p className="text-xs text-gri-500">
          Gömülü veri şu an çekilemedi. Yukarıdaki panellerden trafiği
          görüntüleyebilirsin.
        </p>
      )}
    </div>
  );
}

function EnvMissingCard({ setup }: { setup?: Ga4SetupStatus }) {
  const missing = setup?.missing ?? [
    "GA4_PROPERTY_ID",
    "GA4_SA_CLIENT_EMAIL",
    "GA4_SA_PRIVATE_KEY",
  ];

  return (
    <div className="space-y-4">
      {setup?.measurementIdSet && (
        <Card className="border-yesil/30 bg-yesil-soft/20">
          <div className="flex items-start gap-3">
            <span className="text-yesil text-lg leading-none">✓</span>
            <div>
              <p className="text-sm font-semibold text-lacivert">
                Site trafiği toplanıyor
              </p>
              <p className="mt-1 text-sm text-gri-700">
                Measurement ID{" "}
                <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">
                  {setup.measurementId}
                </code>{" "}
                canlı sitede aktif. Ziyaretçi verisi GA4&apos;te birikiyor.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Icon.Info size={20} />
          </div>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                GA4 Data API env eksik
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Bu sayfanın grafikleri için GA4 Data API env değişkenleri
                gerekli. Aşağıdaki değişkenleri Vercel&apos;e ekleyip redeploy
                edin.
              </p>
            </div>

            <div className="rounded-lg bg-gri-50 px-3 py-2.5 text-sm text-gri-700">
              <p className="font-semibold text-lacivert mb-2">Eksik env:</p>
              <ul className="space-y-1">
                {missing.map((key) => (
                  <li key={key} className="font-mono text-xs">
                    {key}
                  </li>
                ))}
              </ul>
            </div>

            <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
              <li>
                <strong>GA4 Property ID:</strong> analytics.google.com → Admin →
                Property Settings → Property ID (sayı, örn.{" "}
                <code className="rounded bg-gray-100 px-1 text-xs">123456789</code>
                ) → Vercel env{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                  GA4_PROPERTY_ID
                </code>
              </li>
              <li>
                <strong>Service account:</strong> Google Cloud Console → IAM →
                Service Accounts → JSON key oluştur → GA4 property&apos;de bu
                hesaba <strong>Viewer</strong> yetkisi ver.
              </li>
              <li>
                <strong>Vercel env (Production):</strong>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                      GA4_SA_CLIENT_EMAIL
                    </code>
                  </li>
                  <li>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                      GA4_SA_PRIVATE_KEY
                    </code>{" "}
                    (PEM, satır sonları <code>\n</code> ile)
                  </li>
                </ul>
                Search Console için zaten{" "}
                <code className="rounded bg-gray-100 px-1 text-xs">
                  GSC_SA_*
                </code>{" "}
                tanımlıysa aynı service account kullanılabilir.
              </li>
            </ol>

            <p className="text-xs text-gray-500">
              Env ekledikten sonra Vercel&apos;de redeploy gerekir. Veri 24–48
              saat içinde panelde görünür. Alternatif: Vercel Dashboard →
              Analytics sekmesi (ek env gerektirmez).
            </p>
          </div>
        </div>
      </Card>
    </div>
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

function RealtimeCard() {
  const [rt, setRt] = useState<RealtimeResponse | null>(null);
  const [pulse, setPulse] = useState(false);

  const loadRt = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/traffic/realtime", {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as RealtimeResponse;
      setRt(json);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {
      /* sessiz — canlı kart kritik değil */
    }
  }, []);

  useEffect(() => {
    void loadRt();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void loadRt();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadRt]);

  if (!rt || !rt.configured) return null;

  const maxMin = Math.max(...rt.byMinute.map((m) => m.users), 1);

  return (
    <Card className="border-yesil/40 bg-gradient-to-br from-yesil-soft/30 to-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full bg-yesil transition-transform",
                pulse && "scale-150"
              )}
            />
            <Eyebrow>Şu an sitede</Eyebrow>
          </div>
          <p className="mt-1 text-4xl font-bold tabular-nums text-lacivert">
            {formatCount(rt.activeUsers)}
          </p>
          <p className="text-xs text-gri-500">son 30 dakika · canlı (30 sn)</p>
        </div>
        <div className="flex h-16 items-end gap-0.5">
          {rt.byMinute.map((m) => (
            <div
              key={m.minutesAgo}
              className="w-1.5 rounded-t bg-yesil/70"
              style={{ height: `${Math.max((m.users / maxMin) * 100, 4)}%` }}
              title={`${m.minutesAgo} dk önce: ${m.users}`}
            />
          ))}
        </div>
      </div>

      {rt.activeUsers > 0 && (
        <div className="mt-4 grid gap-4 border-t border-gri-100 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-500">
              Aktif sayfalar
            </p>
            <ul className="mt-1.5 space-y-1">
              {rt.topPages.slice(0, 4).map((p) => (
                <li key={p.path} className="flex justify-between gap-2 text-xs">
                  <span className="truncate text-gri-700">{p.path}</span>
                  <span className="font-medium tabular-nums text-lacivert">
                    {formatCount(p.users)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-500">
              Ülke
            </p>
            <ul className="mt-1.5 space-y-1">
              {rt.byCountry.slice(0, 4).map((c) => (
                <li
                  key={c.country}
                  className="flex justify-between gap-2 text-xs"
                >
                  <span className="truncate text-gri-700">{c.country}</span>
                  <span className="font-medium tabular-nums text-lacivert">
                    {formatCount(c.users)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-500">
              Cihaz
            </p>
            <ul className="mt-1.5 space-y-1">
              {rt.byDevice.slice(0, 4).map((d) => (
                <li
                  key={d.device}
                  className="flex justify-between gap-2 text-xs"
                >
                  <span className="truncate capitalize text-gri-700">
                    {d.device}
                  </span>
                  <span className="font-medium tabular-nums text-lacivert">
                    {formatCount(d.users)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function GscQueriesCard() {
  const [data, setData] = useState<GscPerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/traffic/gsc", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as GscPerformanceSummary;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <Eyebrow>Search Console — organik sorgular (28 gün)</Eyebrow>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <p className="px-5 py-8 text-sm text-gray-500">GSC verisi yükleniyor…</p>
        ) : !data?.configured ? (
          <p className="px-5 py-8 text-sm text-gray-500">
            {data?.detail ??
              "GSC Performance API yapılandırılmamış. `GSC_SA_*` veya GA4 service account + Search Console erişimi gerekir."}
          </p>
        ) : !data.ok ? (
          <p className="px-5 py-8 text-sm text-amber-800">{data.detail}</p>
        ) : data.rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500">Sorgu verisi yok.</p>
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Sorgu</th>
                <th className="px-5 py-3 text-right">Tıklama</th>
                <th className="px-5 py-3 text-right">Gösterim</th>
                <th className="px-5 py-3 text-right">CTR</th>
                <th className="px-5 py-3 text-right">Pozisyon</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 15).map((row) => (
                <tr
                  key={row.query}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="max-w-xs truncate px-5 py-3 text-gray-900">
                    {row.query}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatCount(row.clicks)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatCount(row.impressions)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatPercent(row.ctr)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {row.position.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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

  let main: ReactNode;

  if (loading && !data) {
    main = (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon.Refresh size={16} className="animate-spin" />
        Trafik verisi yükleniyor…
      </div>
    );
  } else if (error) {
    main = (
      <Card className="max-w-lg border-red-100 bg-red-50/50">
        <p className="text-sm text-red-800">{error}</p>
      </Card>
    );
  } else if (!data || !data.configured) {
    const kind = data?.configured === false ? data.kind : "env_missing";
    const setup = data?.configured === false ? data.setup : undefined;
    main =
      kind === "env_missing" ? (
        <EnvMissingCard setup={setup} />
      ) : (
        <TrafficLinksCard setup={setup} variant={kind} />
      );
  } else {
    const { totals, topPages } = data;
    main = (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Google Analytics 4 — {RANGE_SUBTITLE[range]}
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
          <Eyebrow>
            {range === "24h" ? "Saatlik oturumlar" : "Günlük oturumlar"}
          </Eyebrow>
          <div className="mt-4">
            <LineChart
              points={chartPoints}
              height={160}
              formatY={formatCount}
              valueUnit="oturum"
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
              valueUnit="oturum"
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
      </>
    );
  }

  return (
    <div className="space-y-6">
      <RealtimeCard />
      {main}
      <GscQueriesCard />
    </div>
  );
}
