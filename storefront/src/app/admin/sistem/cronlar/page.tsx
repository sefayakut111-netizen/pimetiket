"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Eyebrow, Skeleton, useToast, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";

interface CronLastRun {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  summary: string | null;
  errorMessage: string | null;
  itemsProcessed: number | null;
}

interface CronEntry {
  name: string;
  schedule: string;
  label: string;
  lastRun: CronLastRun | null;
}

interface HistoryRow {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  summary: string | null;
  error_message: string | null;
  items_processed: number | null;
}

const CRON_WARNINGS: Record<string, string> = {
  "auto-refund":
    "36 saatten eski prova siparislerini otomatik iptal eder ve iade surecini baslatir.",
  "archive-inactive":
    "90 gun boyunca giris yapmayan musteri hesaplarini arsivler (KVKK m.7).",
  "purge-expired-designs":
    "Saklama suresi dolmus tasarim dosyalarini kalici olarak siler.",
  "cleanup-stale-uploads":
    "Tamamlanmamis yukleme oturumlarini temizler.",
};

function truncateError(msg: string, max = 100): string {
  if (msg.length <= max) return msg;
  return `${msg.slice(0, max)}…`;
}

export default function AdminCronlarPage() {
  const toast = useToast();
  const [crons, setCrons] = useState<CronEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [confirmCron, setConfirmCron] = useState<CronEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cron-status", { cache: "no-store" });
      if (!res.ok) throw new Error("Yüklenemedi");
      const json = (await res.json()) as { crons?: CronEntry[] };
      setCrons(json.crons ?? []);
    } catch {
      toast.error("Cron listesi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = async (cronName: string) => {
    setSelected(cronName);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/admin/cron-status?history=${encodeURIComponent(cronName)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Geçmiş yüklenemedi");
      const json = (await res.json()) as { history?: HistoryRow[] };
      setHistory(json.history ?? []);
    } catch {
      toast.error("Geçmiş yüklenemedi");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const runTrigger = async (cronName: string) => {
    setTriggering(cronName);
    try {
      const res = await fetch("/api/admin/cron-status/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cronName }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Tetikleme başarısız");
        return;
      }
      toast.success(`${cronName} çalıştırıldı`);
      void load();
      if (selected === cronName) void loadHistory(cronName);
    } catch {
      toast.error("Tetikleme başarısız");
    } finally {
      setTriggering(null);
      setConfirmCron(null);
    }
  };

  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("tr-TR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1100px] px-6">
        <Eyebrow>Sistem</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold text-lacivert">Cron İzleme</h1>
        <p className="mt-1 text-sm text-gri-700">
          Zamanlanmış görevlerin son çalışma durumu ve manuel tetikleme.
        </p>

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <Card padding="p-0" className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gri-100 text-xs uppercase text-gri-700">
                  <tr>
                    <th className="px-4 py-3">Cron</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Son çalışma</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Süre</th>
                    <th className="px-4 py-3">Özet / Hata</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {crons.map((c) => {
                    const last = c.lastRun;
                    const ok = last?.status === "success";
                    const err = last?.status === "error";
                    const errorText = last?.errorMessage ?? null;
                    return (
                      <tr
                        key={c.name}
                        className={cn(
                          "border-t border-gri-200",
                          selected === c.name && "bg-pim-mercan-tint/20"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-lacivert">{c.label}</div>
                          <div className="font-mono text-xs text-gri-500">{c.name}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{c.schedule}</td>
                        <td className="px-4 py-3">{fmtTime(last?.startedAt ?? null)}</td>
                        <td className="px-4 py-3">
                          {!last ? (
                            <span className="text-gri-500">Henüz yok</span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                ok && "bg-yesil-soft text-yesil-koyu",
                                err && "bg-kirmizi-soft text-kirmizi-koyu",
                                !ok && !err && "bg-gri-100 text-gri-700"
                              )}
                            >
                              {last.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {last?.durationMs != null ? `${last.durationMs}ms` : "—"}
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          {errorText ? (
                            <p
                              className="text-xs text-kirmizi mt-0.5 truncate max-w-md"
                              title={errorText}
                            >
                              {truncateError(errorText)}
                            </p>
                          ) : (
                            <span className="text-xs text-gri-700">
                              {last?.summary ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void loadHistory(c.name)}
                            >
                              Geçmiş
                            </Button>
                            {c.name !== "auditors-agent" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={triggering === c.name}
                                onClick={() => setConfirmCron(c)}
                              >
                                {triggering === c.name ? "…" : "Çalıştır"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {selected && (
          <Card padding="p-6" className="mt-6">
            <h2 className="text-lg font-semibold text-lacivert">
              Son 7 gün — {selected}
            </h2>
            {historyLoading ? (
              <Skeleton className="mt-4 h-24 w-full" />
            ) : history.length === 0 ? (
              <p className="mt-3 text-sm text-gri-700">Kayıt yok.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-gri-200 bg-gri-50 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          h.status === "success"
                            ? "bg-yesil-soft text-yesil-koyu"
                            : h.status === "error"
                              ? "bg-kirmizi-soft text-kirmizi-koyu"
                              : "bg-gri-100 text-gri-700"
                        )}
                      >
                        {h.status}
                      </span>
                      <span className="text-gri-700">{fmtTime(h.started_at)}</span>
                      {h.duration_ms != null && (
                        <span className="font-mono text-xs">{h.duration_ms}ms</span>
                      )}
                      {h.items_processed != null && (
                        <span className="text-xs text-gri-500">
                          {h.items_processed} kayıt
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-lacivert">
                      {h.error_message ?? h.summary ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <Modal
        open={!!confirmCron}
        onClose={() => setConfirmCron(null)}
        title="Cron calistir"
      >
        {confirmCron && (
          <>
            <p className="text-sm text-gri-700 leading-relaxed">
              <strong className="text-lacivert">{confirmCron.label}</strong> (
              {confirmCron.name}) cron&apos;unu manuel tetiklemek istediginizden
              emin misiniz?
            </p>
            {CRON_WARNINGS[confirmCron.name] && (
              <p className="mt-3 text-sm text-sari-koyu bg-sari-soft/30 rounded-lg p-3">
                {CRON_WARNINGS[confirmCron.name]}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmCron(null)}>
                Iptal
              </Button>
              <Button
                variant="primary"
                disabled={!!triggering}
                onClick={() => void runTrigger(confirmCron.name)}
              >
                {triggering === confirmCron.name ? "Calistiriliyor…" : "Calistir"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </main>
  );
}
