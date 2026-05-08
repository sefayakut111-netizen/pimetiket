/**
 * Pim Etiket — /admin (E.3 Dashboard)
 *
 * Operatör/admin ana panel. Mock data.
 */

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

const KPIS = [
  { label: "Bugünkü siparişler", value: "12", sub: "↑ 3 dünden", accent: "text-pim-mercan" },
  { label: "AI flag bekleyen", value: "3", sub: "manuel kontrol gerek", accent: "text-sari" },
  { label: "Prova bekleyen", value: "5", sub: "müşteriden onay", accent: "text-lacivert" },
  { label: "Fason'a iletilecek", value: "8", sub: "atama yapılacak", accent: "text-yesil" },
];

const RECENT_ORDERS = [
  { id: "PE-2026-1188", title: "Kahveci — etiket × 2.500", status: "AI flag", color: "text-sari", bg: "bg-sari-soft", time: "5 dk önce" },
  { id: "PE-2026-1187", title: "Pop-up — sticker × 500", status: "Operatör", color: "text-pim-mercan", bg: "bg-pim-mercan-tint", time: "12 dk önce" },
  { id: "PE-2026-1186", title: "Olea — etiket × 2.000", status: "Üretimde", color: "text-yesil", bg: "bg-yesil-soft", time: "1 saat önce" },
  { id: "PE-2026-1185", title: "Atölye Niş — sticker × 250", status: "Kargoda", color: "text-lacivert", bg: "bg-gri-100", time: "3 saat önce" },
];

const QUICK_LINKS = [
  { href: "/admin/siparisler", label: "Tüm siparişler", icon: <Icon.Box size={20} />, count: 47 },
  { href: "/admin/ai-qc", label: "AI QC kuyruğu", icon: <Icon.Sparkle size={20} />, count: 3, accent: true },
  { href: "/admin/prova", label: "Prova üretim", icon: <Icon.Check size={20} />, count: 5 },
  { href: "/admin/fason", label: "Fason atama", icon: <Icon.Truck size={20} />, count: 8 },
];

export default function AdminDashboardPage() {
  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Header */}
        <div className="mb-7">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            8 MAYIS, CUMA · 14:32
          </div>
          <h1 className="mt-2 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Operatör paneli
          </h1>
          <p className="mt-1 text-base text-gri-700">
            Bugün dikkat etmen gereken işler — özet aşağıda.
          </p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {KPIS.map((k) => (
            <Card key={k.label} padding="p-5">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                {k.label}
              </div>
              <div className={cn("text-[36px] font-bold mt-1.5 leading-none", k.accent)}>
                {k.value}
              </div>
              <div className="text-[12.5px] text-gri-700 mt-1.5">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={cn(
                "rounded-lg p-5 ring-1 transition-transform hover:-translate-y-0.5 shadow-1 flex items-center gap-4",
                q.accent
                  ? "bg-pim-mercan text-white ring-pim-mercan"
                  : "bg-white text-lacivert ring-gri-200"
              )}
            >
              <div
                className={cn(
                  "grid place-items-center w-11 h-11 rounded-xl shrink-0",
                  q.accent ? "bg-white/20" : "bg-pim-mercan-tint text-pim-mercan"
                )}
              >
                {q.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[15px]">{q.label}</div>
                <div className={cn("text-[12.5px] mt-0.5", q.accent ? "opacity-80" : "text-gri-700")}>
                  {q.count} bekliyor
                </div>
              </div>
              <Icon.ArrowR size={16} />
            </Link>
          ))}
        </div>

        {/* 2-col main */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
          {/* Recent orders */}
          <Card padding="p-0">
            <div className="px-6 py-4 border-b border-gri-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Son siparişler</h2>
              <Link
                href="/admin/siparisler"
                className="text-[13px] font-semibold text-pim-mercan hover:underline"
              >
                Tümünü gör →
              </Link>
            </div>
            <div className="divide-y divide-gri-100">
              {RECENT_ORDERS.map((o) => (
                <Link
                  key={o.id}
                  href={`/siparis/${o.id}`}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-gri-50 transition-colors"
                >
                  <span
                    className={cn(
                      "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold shrink-0",
                      o.bg,
                      o.color
                    )}
                  >
                    {o.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] truncate">
                      {o.title}
                    </div>
                    <div className="text-[12px] text-gri-700 mt-0.5">
                      <span className="font-mono">{o.id}</span> · {o.time}
                    </div>
                  </div>
                  <Icon.ChevR size={14} className="text-gri-500" />
                </Link>
              ))}
            </div>
          </Card>

          {/* Today's tasks */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Bugünün ajandası</h2>
            <ul className="space-y-3">
              {[
                { t: "AI flag'lenenleri kontrol et", c: 3, accent: "text-sari" },
                { t: "Prova provayı kalibre et — Olea", c: 1, accent: "text-pim-mercan" },
                { t: "Fason ortağa atama yap — 8 sipariş", c: 8, accent: "text-yesil" },
                { t: "Yeni KB kuralı eklendiği için test", c: 1, accent: "text-lacivert" },
              ].map((task, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gri-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-pim-mercan shrink-0"
                  />
                  <div className="flex-1">
                    <div className="text-[14px] leading-snug">{task.t}</div>
                    <div className={cn("text-[11.5px] font-semibold mt-0.5", task.accent)}>
                      {task.c} adet
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
