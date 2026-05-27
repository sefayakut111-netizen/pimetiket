"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton, useToast } from "@/components/ui";
import {
  PartnerAssignmentCard,
  type PartnerAssignmentRow,
} from "@/components/partner";

interface DashboardPayload {
  partner_name: string;
  stats: {
    pending: number;
    in_production: number;
    completed: number;
    avg_delivery_days: number | null;
  };
  urgent_queue: PartnerAssignmentRow[];
  recent_activity: Array<{
    order_id: string;
    label: string;
    at: string;
    relative: string;
  }>;
}

export default function PartnerDashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as DashboardPayload);
    } catch {
      toast.error("Dashboard yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6 pb-24 lg:pb-6">
        <Skeleton className="mb-4 h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-sm text-gri-700">
        Veriler yüklenemedi.
      </div>
    );
  }

  const { partner_name, stats, urgent_queue, recent_activity } = data;

  return (
    <div className="p-4 md:p-6 pb-24 lg:pb-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-lacivert">
          Hoş geldin, {partner_name}
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          Son 30 günlük üretim performansın
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="BEKLEYEN"
          value={String(stats.pending)}
          href="/partner/siparisler?status=pending"
          accent="mercan"
        />
        <StatCard
          label="ÜRETİMDE"
          value={String(stats.in_production)}
          href="/partner/siparisler?status=active"
          accent="lacivert"
        />
        <StatCard
          label="TAMAMLANAN"
          value={String(stats.completed)}
          href="/partner/siparisler?status=completed"
          accent="yesil"
        />
        <StatCard
          label="ORT. SÜRE"
          value={
            stats.avg_delivery_days != null
              ? `${stats.avg_delivery_days} gün`
              : "—"
          }
          href="/partner/siparisler?status=completed"
          accent="gri"
          isText
        />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-lacivert">Acil Sıradakiler</h2>
          <Link
            href="/partner/siparisler?status=urgent"
            className="text-sm font-semibold text-pim-mercan hover:underline"
          >
            Tüm acil işler →
          </Link>
        </div>

        {urgent_queue.length === 0 ? (
          <div className="rounded-2xl border border-gri-200 bg-white p-8 text-center">
            <p className="text-sm text-gri-700">Şu an acil iş yok.</p>
            <Link
              href="/partner/siparisler"
              className="mt-2 inline-block text-sm font-semibold text-pim-mercan hover:underline"
            >
              Tüm işlere git
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {urgent_queue.map((row) => (
              <PartnerAssignmentCard
                key={row.assignment_id}
                row={row}
                onRefresh={() => void load()}
                onError={(msg) => toast.error(msg)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-lacivert">Son Aktivite</h2>
        {recent_activity.length === 0 ? (
          <p className="text-sm text-gri-600">Henüz aktivite kaydı yok.</p>
        ) : (
          <ul className="rounded-2xl border border-gri-200 bg-white divide-y divide-gri-100">
            {recent_activity.map((a) => (
              <li
                key={`${a.order_id}-${a.at}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="text-gri-800">
                  <span className="font-mono text-pim-mercan">
                    #{a.order_id.slice(-8)}
                  </span>{" "}
                  {a.label}
                </span>
                <span className="shrink-0 text-[12px] text-gri-500">
                  {a.relative}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
  isText,
}: {
  label: string;
  value: string;
  href: string;
  accent: "mercan" | "lacivert" | "yesil" | "gri";
  isText?: boolean;
}) {
  const color =
    accent === "mercan"
      ? "text-pim-mercan"
      : accent === "yesil"
        ? "text-yesil"
        : accent === "gri"
          ? "text-lacivert"
          : "text-lacivert";

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gri-200 bg-white p-5 shadow-sm transition-colors hover:border-pim-mercan/40"
    >
      <p className="text-[11px] font-bold tracking-wide text-gri-600">{label}</p>
      <p
        className={`mt-2 font-bold ${color} ${isText ? "text-2xl" : "text-4xl tabular-nums"}`}
      >
        {value}
      </p>
    </Link>
  );
}
