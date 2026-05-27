/**
 * /admin/aboneler — Email abone listesi
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Button, Eyebrow, Skeleton, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { StatusDot } from "@/components/admin/ui";
import { isTestSubscriber } from "@/lib/admin-order-filters";
import type { SubscriberRow } from "@/app/api/admin/subscribers/route";

const SOURCE_LABEL: Record<string, { label: string }> = {
  sablonlar: { label: "Şablon" },
  newsletter: { label: "Bülten" },
  order_complete: { label: "Sipariş sonrası" },
  gated_download: { label: "İçerik" },
  manual_import: { label: "Manuel" },
};

const FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "sablonlar", label: "Şablon" },
  { id: "newsletter", label: "Bülten" },
  { id: "order_complete", label: "Sipariş sonrası" },
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün`;
  return new Date(ts).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

export default function AdminAbonelerPage() {
  const [allSubscribers, setAllSubscribers] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showTestSubscribers, setShowTestSubscribers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/admin/subscribers")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ subscribers: SubscriberRow[] }>;
      })
      .then((body) => {
        if (cancelled) return;
        setAllSubscribers(body.subscribers);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCatalog = useMemo(
    () =>
      showTestSubscribers
        ? allSubscribers
        : allSubscribers.filter((s) => !isTestSubscriber(s.email)),
    [allSubscribers, showTestSubscribers]
  );

  const hiddenTestCount = useMemo(
    () => allSubscribers.filter((s) => isTestSubscriber(s.email)).length,
    [allSubscribers]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: visibleCatalog.length };
    for (const f of FILTERS) {
      if (f.id === "all") continue;
      counts[f.id] = visibleCatalog.filter((s) => s.source === f.id).length;
    }
    return counts;
  }, [visibleCatalog]);

  const data = useMemo(() => {
    if (filter === "all") return visibleCatalog;
    return visibleCatalog.filter((s) => s.source === filter);
  }, [visibleCatalog, filter]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        s.interests.some((i) => i.toLowerCase().includes(q))
    );
  }, [data, search]);

  const pendingWelcome = visibleCatalog.filter(
    (s) => !s.welcomeSentAt && s.subscribed
  ).length;
  const sablonlarCount = visibleCatalog.filter(
    (s) => s.source === "sablonlar"
  ).length;

  const csvUrl =
    filter === "all"
      ? "/api/admin/subscribers?format=csv"
      : `/api/admin/subscribers?source=${filter}&format=csv`;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <Eyebrow>Email Listesi</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Aboneler
            </h1>
            {loading ? (
              <div className="mt-2 h-5 w-[220px] rounded bg-gri-100 animate-pulse" />
            ) : (
              <p className="mt-1.5 text-base text-gri-700">
                {[
                  `${visibleCatalog.length} aktif abone`,
                  pendingWelcome > 0
                    ? `${pendingWelcome} welcome mail bekliyor`
                    : null,
                  sablonlarCount > 0 ? `${sablonlarCount} şablon kaydı` : null,
                ]
                  .filter(Boolean)
                  .map((s, i, arr) => (
                    <span
                      key={i}
                      className={
                        i === 1 && pendingWelcome > 0
                          ? "text-sari-koyu font-semibold"
                          : ""
                      }
                    >
                      {s}
                      {i < arr.length - 1 ? " · " : ""}
                    </span>
                  ))}
              </p>
            )}
          </div>
          <a href={csvUrl} download>
            <Button variant="secondary" size="md">
              <Icon.Doc size={14} /> CSV indir
            </Button>
          </a>
        </div>

        {pendingWelcome > 0 && (
          <Card padding="p-4" className="mb-6 bg-sari-soft ring-sari/20">
            <div className="flex items-start gap-3">
              <StatusDot color="sari" className="w-3 h-3 mt-1.5 shrink-0" />
              <div className="flex-1">
                <h2 className="text-[13.5px] font-semibold text-lacivert">
                  Resend mail otomasyonu henüz aktif değil
                </h2>
                <p className="text-[12.5px] text-gri-700 mt-0.5 leading-relaxed">
                  {pendingWelcome} kişi welcome maili bekliyor. Resend
                  dashboard&apos;dan domain doğrulayıp Vercel&apos;de{" "}
                  <code className="text-[11px] bg-white/60 px-1 rounded">
                    RESEND_API_KEY
                  </code>{" "}
                  aktifleştirince kuyruk otomatik boşalır. Bu arada CSV&apos;yi
                  indirip manuel mail atabilirsin.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTERS.map((f) => (
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
                {f.label} ({tabCounts[f.id] ?? 0})
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-[13px] text-gri-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTestSubscribers}
                onChange={(e) => setShowTestSubscribers(e.target.checked)}
                className="rounded border-gri-300 text-pim-mercan focus:ring-pim-mercan"
              />
              Test abonelerini göster
              {hiddenTestCount > 0 && !showTestSubscribers && (
                <span className="text-gri-500">({hiddenTestCount} gizli)</span>
              )}
            </label>
            <div className="w-full sm:w-auto sm:min-w-[280px] relative">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Email veya ilgi alanı ara…"
                className="!h-11 !pl-10"
              />
              <Icon.Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
              />
            </div>
          </div>
        </Card>

        {loading ? (
          <Skeleton.AdminTable rows={4} />
        ) : error ? (
          <Card padding="p-10" className="text-center">
            <Icon.Info size={32} className="text-kirmizi mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Liste yüklenemedi</h3>
            <p className="text-[13px] text-gri-700 mt-1">{error}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="wait" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {data.length === 0 ? "Henüz abone yok" : "Bu aramada sonuç yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {data.length === 0
                ? "/sablonlar sayfasından ilk kayıt geldiğinde burada görünecek."
                : "Aramayı temizle ya da farklı bir filtre dene."}
            </p>
          </Card>
        ) : (
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    E-posta
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Kaynak
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    İlgi alanları
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Welcome mail
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Kayıt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {filtered.map((s) => {
                  const meta = SOURCE_LABEL[s.source] ?? {
                    label: s.source,
                  };
                  return (
                    <tr key={s.id} className="hover:bg-gri-50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-lacivert text-[12.5px]">
                          {s.email}
                        </div>
                        {!s.subscribed && (
                          <span className="inline-flex items-center h-[18px] px-1.5 mt-0.5 rounded-full bg-gri-100 text-gri-700 text-[10px] font-bold">
                            Abonelikten çıkmış
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11.5px] font-bold">
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.interests.length === 0 ? (
                          <span className="text-gri-500 italic text-[11.5px]">
                            seçim yok
                          </span>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {s.interests.slice(0, 3).map((i) => (
                              <span
                                key={i}
                                className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-gri-100 text-gri-700 text-[10.5px] font-semibold"
                              >
                                {i}
                              </span>
                            ))}
                            {s.interests.length > 3 && (
                              <span className="text-[10.5px] text-gri-500">
                                +{s.interests.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.welcomeSentAt ? (
                          <span className="inline-flex items-center gap-1 text-yesil text-[11.5px] font-semibold">
                            <Icon.Check size={11} /> Gönderildi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sari-koyu text-[11.5px] font-semibold">
                            Bekliyor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gri-700 text-[12px]">
                        {timeAgo(s.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </main>
  );
}
