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

function exportCsv(entries: AuditEntry[]): void {
  const header = "ID,Tarih,Aksiyon,Yapan,Hedef,Özet,IP\n";
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

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    ensureAuthBindings();
    const refresh = () => setEntries(listAuditEntries());
    void refreshAuditLog().then(refresh);
    window.addEventListener("pim_audit_log_updated", refresh);
    return () =>
      window.removeEventListener("pim_audit_log_updated", refresh);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        (e.targetId ?? "").toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        (ACTION_LABEL[e.action] ?? "").toLowerCase().includes(q)
    );
  }, [entries, search]);

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
              {entries.length} kayıt — kim ne zaman ne yaptı (KVKK gereği saklanır)
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

        {/* Search */}
        <Card padding="p-4" className="mb-5">
          <div className="relative">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID, aksiyon, kullanıcı, hedef ara…"
              className="!h-11 !pl-10"
            />
            <Icon.Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
            />
          </div>
        </Card>

        {filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="inspect" size={140} />
            <h3 className="mt-4 text-xl font-semibold">
              {entries.length === 0
                ? "Audit log boş"
                : "Bu aramada sonuç yok"}
            </h3>
            <p className="mt-2 text-base text-gri-700 max-w-[480px] mx-auto leading-relaxed">
              {entries.length === 0
                ? "Admin işlemleri (sipariş güncellemesi, iade onayı, kupon oluşturma, vb) burada listelenir. KVKK gereği 5 yıl saklanır."
                : "Arama metnini değiştirmeyi dene."}
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
                    Özet
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {filtered.map((e) => {
                  // Sefa 20 May v68: hydration-safe (Europe/Istanbul)
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
                          {ACTION_LABEL[e.action] ?? e.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-lacivert">
                        {e.actor}
                      </td>
                      <td className="px-4 py-3 text-gri-700 font-mono text-[12px]">
                        {e.targetId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gri-700 max-w-[400px] truncate">
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
