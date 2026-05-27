/**
 * Pim Etiket — /admin/audit-log
 *
 * KVKK gereği audit trail. Tüm admin işlemleri buraya düşer.
 * Filtreli aranabilir, CSV export.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format-date";
import {
  listAuditEntries,
  refreshAuditLog,
  ACTION_LABEL,
  type AuditEntry,
  type AuditAction,
} from "@/lib/audit-log";
import { ensureAuthBindings } from "@/lib/customer-cart";

const ACTION_COLOR: Partial<Record<AuditAction, string>> = {
  "order.cancel": "text-kirmizi bg-kirmizi/10",
  "return.refund": "text-yesil bg-yesil-soft",
  "return.approve": "text-yesil bg-yesil-soft",
  "return.reject": "text-kirmizi bg-kirmizi/10",
  "settings.update": "text-pim-mercan bg-pim-mercan-tint",
  "staff.invite": "text-pim-mercan bg-pim-mercan-tint",
  "staff.remove": "text-kirmizi bg-kirmizi/10",
};

type ActionFilter =
  | "all"
  | "settings"
  | "order"
  | "kvkk"
  | "auth"
  | "telif";

type DateRange = "7d" | "30d" | "90d" | "all";

const ACTION_FILTER_LABEL: Record<ActionFilter, string> = {
  all: "Tumu",
  settings: "Ayar degisikligi",
  order: "Siparis",
  kvkk: "KVKK",
  auth: "Giris/Cikis",
  telif: "Telif",
};

const DATE_RANGE_LABEL: Record<DateRange, string> = {
  "7d": "Son 7 gun",
  "30d": "Son 30 gun",
  "90d": "Son 90 gun",
  all: "Tum zamanlar",
};

function isTelifEntry(e: AuditEntry): boolean {
  const s = e.summary.toLowerCase();
  return (
    s.includes("telif") ||
    (e.detail?.includes("copyright_accepted") ?? false)
  );
}

function categorizeAction(e: AuditEntry): ActionFilter {
  if (isTelifEntry(e)) return "telif";
  if (e.action.startsWith("order.")) return "order";
  if (e.action.startsWith("auth.")) return "auth";
  if (e.action === "profile.delete") return "kvkk";
  if (e.action.startsWith("settings.")) return "settings";
  if (e.action.startsWith("return.")) return "order";
  if (e.action.startsWith("coupon.")) return "settings";
  if (e.action.startsWith("staff.")) return "settings";
  return "all";
}

function exportCsv(entries: AuditEntry[]): void {
  const header = "ID,Tarih,Aksiyon,Yapan,Hedef,Ozet,IP\n";
  const rows = entries
    .map((e) =>
      [
        e.id,
        e.createdAtIso,
        ACTION_LABEL[e.action] ?? e.action,
        e.actor,
        e.targetId ?? "",
        `"${(e.summary ?? "").replace(/"/g, '""')}"`,
        e.ip ?? "",
      ].join(",")
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pim-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type DisplayRow =
  | { kind: "entry"; entry: AuditEntry }
  | { kind: "telif-group"; count: number; entries: AuditEntry[] };

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [telifExpanded, setTelifExpanded] = useState(false);

  useEffect(() => {
    ensureAuthBindings();
    const refresh = () => setEntries(listAuditEntries());
    void refreshAuditLog().then(refresh);
    window.addEventListener("pim_audit_log_updated", refresh);
    return () =>
      window.removeEventListener("pim_audit_log_updated", refresh);
  }, []);

  const actors = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.actor) set.add(e.actor);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [entries]);

  const rangeStart = useMemo(() => {
    const now = Date.now();
    if (dateRange === "7d") return now - 7 * 86400_000;
    if (dateRange === "30d") return now - 30 * 86400_000;
    if (dateRange === "90d") return now - 90 * 86400_000;
    return 0;
  }, [dateRange]);

  const filtered = useMemo(() => {
    let list = entries;
    if (rangeStart > 0) {
      list = list.filter((e) => e.createdAt >= rangeStart);
    }
    if (actorFilter !== "all") {
      list = list.filter((e) => e.actor === actorFilter);
    }
    if (actionFilter !== "all") {
      list = list.filter((e) => categorizeAction(e) === actionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q) ||
          (e.targetId ?? "").toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          (ACTION_LABEL[e.action] ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, rangeStart, actorFilter, actionFilter, search]);

  const displayRows = useMemo((): DisplayRow[] => {
    if (actionFilter === "telif") {
      return filtered.map((entry) => ({ kind: "entry", entry }));
    }

    const telifEntries = filtered.filter(isTelifEntry);
    const otherEntries = filtered.filter((e) => !isTelifEntry(e));
    const rows: DisplayRow[] = otherEntries.map((entry) => ({
      kind: "entry",
      entry,
    }));

    if (telifEntries.length > 0) {
      rows.push({
        kind: "telif-group",
        count: telifEntries.length,
        entries: telifEntries,
      });
    }
    return rows;
  }, [filtered, actionFilter]);

  const visibleRows = useMemo(() => {
    if (actionFilter === "telif" || telifExpanded) {
      return filtered.map((entry) => ({ kind: "entry" as const, entry }));
    }
    return displayRows;
  }, [actionFilter, telifExpanded, filtered, displayRows]);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Güvenlik · KVKK</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Audit log
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              {entries.length} kayit — kim ne zaman ne yapti (KVKK geregi saklanir)
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => exportCsv(filtered)}
            disabled={entries.length === 0}
          >
            <Icon.Box size={16} /> CSV indir
          </Button>
        </div>

        <Card padding="p-4" className="mb-5 space-y-3">
          <div className="relative">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID, aksiyon, kullanici, hedef ara…"
              className="!h-11 !pl-10"
            />
            <Icon.Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACTION_FILTER_LABEL) as ActionFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActionFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition",
                  actionFilter === f
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {ACTION_FILTER_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="rounded-lg border border-gri-200 px-3 py-2 text-sm"
            >
              {(Object.keys(DATE_RANGE_LABEL) as DateRange[]).map((r) => (
                <option key={r} value={r}>
                  {DATE_RANGE_LABEL[r]}
                </option>
              ))}
            </select>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded-lg border border-gri-200 px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="all">Tum kullanicilar</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="text-sm text-gri-500">
              {filtered.length} sonuc
            </span>
          </div>
        </Card>

        {visibleRows.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="inspect" size={140} />
            <h3 className="mt-4 text-xl font-semibold">
              {entries.length === 0
                ? "Audit log bos"
                : "Bu filtrede sonuc yok"}
            </h3>
            <p className="mt-2 text-base text-gri-700 max-w-[480px] mx-auto leading-relaxed">
              {entries.length === 0
                ? "Admin islemleri burada listelenir. KVKK geregi 5 yil saklanir."
                : "Filtreleri degistirmeyi dene."}
            </p>
          </Card>
        ) : (
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Tarih
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Aksiyon
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Yapan
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Hedef
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Ozet
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {visibleRows.map((row) => {
                  if (row.kind === "telif-group") {
                    return (
                      <tr key="telif-group" className="bg-gri-50">
                        <td colSpan={6} className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setTelifExpanded((v) => !v)}
                            className="text-sm font-semibold text-pim-mercan hover:underline"
                          >
                            {row.count} telif taahut onay kaydi (gruplandi) —{" "}
                            {telifExpanded ? "daralt" : "genislet"}
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  const e = row.entry;
                  const date = fmtDateTime(e.createdAtIso);
                  return (
                    <tr key={e.id} className="hover:bg-gri-50">
                      <td className="px-4 py-3 text-gri-700 text-[12.5px] tabular-nums whitespace-nowrap">
                        {date}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            ACTION_COLOR[e.action] ??
                              "bg-gri-100 text-gri-700"
                          )}
                        >
                          {isTelifEntry(e)
                            ? "Telif taahut"
                            : ACTION_LABEL[e.action] ?? e.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-lacivert">
                        {e.actor}
                      </td>
                      <td className="px-4 py-3 text-gri-700 font-mono text-[12px]">
                        {e.targetId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gri-700 max-w-[400px]">
                        {e.summary}
                      </td>
                      <td className="px-4 py-3 text-gri-500 font-mono text-[11.5px]">
                        {e.ip ?? "—"}
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
