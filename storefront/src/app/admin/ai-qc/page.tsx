/**
 * Pim Etiket — /admin/ai-qc (v2 — Supabase backed)
 *
 * Sefa kuralı (16 May v3 baskı onay akışı):
 *   Müşteri ödeme yapar → Design QC agent fire-and-forget çalışır →
 *   verdict'e göre order.status = "human_review" veya "proof_generating".
 *   Bu sayfa "human_review" / "human_review_failed" siparişlerini sunar,
 *   operatör approve → ready_to_ship, reject → human_review_failed.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getAdminStatusLabel } from "@/lib/admin-status";

const fmtTotal = (n: number) =>
  Math.round(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

interface QCRun {
  runId: string;
  verdict: "iyi" | "normal" | "kotu" | "error";
  score: number | null;
  fileType: string | null;
  effectiveDpi: number | null;
  findings: Array<{
    severity: "info" | "warning" | "error";
    category: string;
    message: string;
    actionable?: string;
  }> | null;
  fileId: string | null;
  fileName: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  createdAt: string;
}

interface QueueItem {
  orderId: string;
  status: string;
  createdAt: string;
  total: number;
  customerName: string;
  items: Array<{
    product: string;
    title: string;
    width: number;
    height: number;
    qty: number;
  }>;
  qcRuns: QCRun[];
}

interface HistoryItem {
  orderId: string;
  decision: "approve" | "reject" | "fix_and_proof";
  operatorName: string;
  createdAt: string;
  note: string | null;
  summary: string;
}

type Decision = "approve" | "reject" | "fix_and_proof";

const VERDICT_COLORS: Record<string, string> = {
  iyi: "bg-yesil text-white",
  normal: "bg-saman text-lacivert",
  kotu: "bg-kirmizi text-white",
  error: "bg-gri-700 text-white",
};

const VERDICT_LABELS: Record<string, string> = {
  iyi: "✓ İYİ",
  normal: "~ NORMAL",
  kotu: "✗ KÖTÜ",
  error: "! HATA",
};

const HISTORY_DECISION_ICON: Record<HistoryItem["decision"], string> = {
  approve: "✅",
  reject: "❌",
  fix_and_proof: "🔧",
};

function QCRunCard({ run }: { run: QCRun }) {
  return (
    <div className="rounded-lg ring-1 ring-gri-200 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-lacivert truncate">
            {run.fileName ?? "—"}
            {run.downloadUrl && (
              <a
                href={run.downloadUrl}
                download={run.fileName ?? "design"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-pim-mercan hover:underline ml-2"
              >
                📥 İndir
              </a>
            )}
          </div>
          <div className="text-[11.5px] text-gri-700 mt-0.5">
            {run.fileType ?? "?"}
            {run.effectiveDpi != null && (
              <> · {Math.round(run.effectiveDpi)} DPI</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {run.score != null && (
            <span className="font-mono text-[12px] tabular-nums">
              {run.score}/100
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold",
              VERDICT_COLORS[run.verdict] ?? VERDICT_COLORS.error
            )}
          >
            {VERDICT_LABELS[run.verdict] ?? run.verdict}
          </span>
        </div>
      </div>

      {run.previewUrl && (
        <div className="mt-3 rounded-lg overflow-hidden ring-1 ring-gri-200 bg-gri-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={run.previewUrl}
            alt={run.fileName ?? "Tasarım"}
            className="w-full max-h-[300px] object-contain"
            loading="lazy"
          />
        </div>
      )}

      {!run.previewUrl && run.fileName && (
        <div className="mt-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 p-6 text-center">
          <Icon.Doc size={32} className="text-gri-400 mx-auto mb-2" />
          <div className="text-[12px] text-gri-500">{run.fileName}</div>
          <div className="text-[11px] text-gri-400 mt-1">
            Önizleme desteklenmiyor — dosyayı indirip kontrol edin
          </div>
        </div>
      )}

      {Array.isArray(run.findings) && run.findings.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {run.findings.map((f, idx) => (
            <li
              key={idx}
              className="text-[12.5px] leading-relaxed flex items-start gap-2"
            >
              <span
                className={cn(
                  "shrink-0 w-1.5 h-1.5 rounded-full mt-1.5",
                  f.severity === "error"
                    ? "bg-kirmizi"
                    : f.severity === "warning"
                      ? "bg-saman"
                      : "bg-gri-500"
                )}
              />
              <span>
                <strong className="text-lacivert">{f.category}:</strong>{" "}
                {f.message}
                {f.actionable && (
                  <em className="block text-gri-700 mt-0.5">→ {f.actionable}</em>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminAiQcPage() {
  const toast = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [note, setNote] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState({
    approved: 0,
    rejected: 0,
    fixed: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-qc/queue", {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; queue?: QueueItem[] };
      if (data.ok && Array.isArray(data.queue)) {
        setQueue(data.queue);
        setActiveOrderId((prev) => {
          if (prev && data.queue!.some((q) => q.orderId === prev)) return prev;
          return data.queue![0]?.orderId ?? null;
        });
      }
    } catch (err) {
      console.error("[ai-qc] queue fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/ai-qc/history?days=30&limit=50");
      const data = (await res.json()) as {
        ok?: boolean;
        history?: HistoryItem[];
        stats?: { approved: number; rejected: number; fixed: number };
      };
      if (data.ok) {
        setHistory(data.history ?? []);
        setHistoryStats(
          data.stats ?? { approved: 0, rejected: 0, fixed: 0 }
        );
      }
    } catch (err) {
      console.error("[ai-qc] history fetch failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (showHistory) void fetchHistory();
  }, [showHistory, fetchHistory]);

  const kpiStats = useMemo(() => {
    const total = queue.length;
    const avgWaitHours =
      queue.length > 0
        ? queue.reduce(
            (s, q) => s + (Date.now() - new Date(q.createdAt).getTime()),
            0
          ) /
          queue.length /
          3600000
        : 0;
    const kotu = queue.filter((q) => q.qcRuns[0]?.verdict === "kotu").length;
    const error = queue.filter((q) => q.qcRuns[0]?.verdict === "error").length;
    return { total, avgWaitHours, kotu, error };
  }, [queue]);

  const filteredQueue = useMemo(() => {
    if (!verdictFilter) return queue;
    return queue.filter((q) => q.qcRuns[0]?.verdict === verdictFilter);
  }, [queue, verdictFilter]);

  const goodVerdictOrders = useMemo(
    () =>
      queue.filter((q) => {
        const runs = q.qcRuns;
        return runs.length > 0 && runs.every((r) => r.verdict === "iyi");
      }),
    [queue]
  );

  useEffect(() => {
    if (
      activeOrderId &&
      !filteredQueue.some((q) => q.orderId === activeOrderId)
    ) {
      setActiveOrderId(filteredQueue[0]?.orderId ?? null);
    }
  }, [filteredQueue, activeOrderId]);

  const activeIdx = filteredQueue.findIndex((q) => q.orderId === activeOrderId);
  const active = activeIdx >= 0 ? filteredQueue[activeIdx] : null;

  const decide = async (decision: Decision) => {
    if (!active || deciding) return;
    setDeciding(true);
    try {
      const res = await fetch("/api/admin/ai-qc/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: active.orderId,
          decision,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        toast.error(`Karar uygulanamadı: ${data.error ?? "unknown"}`);
        return;
      }
      setNote("");
      await fetchQueue();
    } catch (err) {
      console.error("[ai-qc] decide failed:", err);
      toast.error("Karar uygulanamadı (ağ hatası)");
    } finally {
      setDeciding(false);
    }
  };

  const rerunQc = async () => {
    if (!active || deciding) return;
    if (
      !confirm("AI QC tekrar çalıştırılsın mı? (10-30 saniye sürebilir)")
    ) {
      return;
    }
    setDeciding(true);
    try {
      const res = await fetch("/api/agents/design-qc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: active.orderId, force: true }),
      });
      if (res.ok) {
        toast.success("QC tekrar çalıştırıldı");
        setTimeout(() => void fetchQueue(), 5000);
      } else {
        toast.error("QC başlatılamadı");
      }
    } finally {
      setDeciding(false);
    }
  };

  const bulkApprove = async () => {
    if (deciding || goodVerdictOrders.length === 0) return;
    if (
      !confirm(`${goodVerdictOrders.length} siparişi toplu onaylayalım mı?`)
    ) {
      return;
    }
    setDeciding(true);
    try {
      for (const o of goodVerdictOrders) {
        await fetch("/api/admin/ai-qc/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderId: o.orderId,
            decision: "approve",
            note: "Toplu onay — tüm dosyalar iyi",
          }),
        });
      }
      toast.success(`${goodVerdictOrders.length} sipariş onaylandı`);
      await fetchQueue();
    } finally {
      setDeciding(false);
    }
  };

  if (loading && queue.length === 0 && !showHistory) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <div className="animate-pulse text-gri-700">
            QC kuyruğu yükleniyor…
          </div>
        </div>
      </main>
    );
  }

  const headerBlock = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <Eyebrow>AI QC kuyruğu</Eyebrow>
        <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
          {showHistory ? "Geçmiş kararlar" : "Manuel inceleme kuyruğu"}
        </h1>
        <p className="mt-1.5 text-base text-gri-700">
          {showHistory
            ? "Son 30 günde operatör QC kararları"
            : `${queue.length} sipariş AI ön kontrolünden geçti, operatör kararı bekliyor.`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistory((s) => !s)}
      >
        {showHistory ? "Kuyruk göster" : "📋 Geçmiş kararlar"}
      </Button>
    </div>
  );

  if (showHistory) {
    return (
      <main className="py-8 pb-20">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          {headerBlock}
          <Card padding="p-6">
            {historyLoading ? (
              <p className="text-gri-700 text-[13px]">Yükleniyor…</p>
            ) : history.length === 0 ? (
              <p className="text-gri-700 text-[13px]">
                Son 30 günde kayıtlı karar yok.
              </p>
            ) : (
              <>
                <div className="text-[13px] text-gri-700 mb-4 font-medium">
                  ✅ {historyStats.approved} onay · ❌ {historyStats.rejected}{" "}
                  red · 🔧 {historyStats.fixed} düzeltme
                </div>
                <div className="space-y-3">
                  {history.map((h) => (
                    <div
                      key={`${h.orderId}-${h.createdAt}`}
                      className="rounded-lg ring-1 ring-gri-200 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span>{HISTORY_DECISION_ICON[h.decision]}</span>
                        <Link
                          href={`/admin/siparisler/${h.orderId}`}
                          className="font-mono font-semibold text-pim-mercan hover:underline"
                        >
                          #{h.orderId.slice(0, 8)}
                        </Link>
                        <span className="text-gri-500">·</span>
                        <span className="font-semibold">{h.operatorName}</span>
                        <span className="text-gri-500">· {timeAgo(h.createdAt)}</span>
                      </div>
                      {h.note && (
                        <p className="text-[12px] text-gri-600 mt-1 pl-6">
                          &ldquo;{h.note}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    );
  }

  if (queue.length === 0) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[760px] px-6">
          <div className="mb-6 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              📋 Geçmiş kararlar
            </Button>
          </div>
          <div className="text-center mb-10">
            <Pim pose="happy" size={140} />
            <h1 className="mt-4 text-[28px] font-semibold tracking-tight">
              Kuyruk temiz! 🎉
            </h1>
            <p className="mt-3 text-base text-gri-700 leading-relaxed">
              Manuel inceleme bekleyen sipariş yok. Yeni QC flag&apos;i geldiğinde
              burada görünür.
            </p>
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-gri-200 p-6">
            <h2 className="text-[15px] font-semibold mb-4 text-lacivert">
              📚 AI QC nasıl çalışır?
            </h2>
            <ol className="space-y-3 text-[13.5px] text-gri-700 leading-relaxed">
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-mavi-soft text-mavi-koyu font-bold flex items-center justify-center text-[12px]">
                  1
                </span>
                <div>
                  <strong className="text-lacivert">Müşteri sipariş veriyor</strong>{" "}
                  + tasarım yüklüyor (PDF/AI/PSD/PNG).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-mavi-soft text-mavi-koyu font-bold flex items-center justify-center text-[12px]">
                  2
                </span>
                <div>
                  <strong className="text-lacivert">AI motor kontrol ediyor:</strong>{" "}
                  DPI, CMYK, bleed, font outline.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-sari-soft text-sari-koyu font-bold flex items-center justify-center text-[12px]">
                  3
                </span>
                <div>
                  <strong className="text-lacivert">Sorun bulursa</strong> burada
                  flag oluşur — onayla / düzelt / reddet.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-yesil-soft text-yesil-koyu font-bold flex items-center justify-center text-[12px]">
                  4
                </span>
                <div>
                  <strong className="text-lacivert">Sorun yoksa otomatik</strong>{" "}
                  üretim hattına aktarılır.
                </div>
              </li>
            </ol>
          </div>
        </div>
      </main>
    );
  }

  if (!active) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[600px] px-6 text-center text-gri-700">
          Filtreye uyan sipariş yok.
        </div>
      </main>
    );
  }

  const product =
    active.items.length === 1
      ? active.items[0].title
      : `${active.items.length} ürün`;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {headerBlock}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Kuyrukta
            </div>
            <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">
              {kpiStats.total}
            </div>
          </Card>
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Ort. bekleme
            </div>
            <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">
              {kpiStats.avgWaitHours < 1
                ? `${Math.round(kpiStats.avgWaitHours * 60)} dk`
                : `${kpiStats.avgWaitHours.toFixed(1)} sa`}
            </div>
          </Card>
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Kötü verdict
            </div>
            <div
              className={cn(
                "text-[22px] font-bold tabular-nums mt-1",
                kpiStats.kotu > 0 ? "text-kirmizi" : "text-lacivert"
              )}
            >
              {kpiStats.kotu}
            </div>
          </Card>
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Hata
            </div>
            <div
              className={cn(
                "text-[22px] font-bold tabular-nums mt-1",
                kpiStats.error > 0 ? "text-kirmizi" : "text-lacivert"
              )}
            >
              {kpiStats.error}
            </div>
          </Card>
        </div>

        {goodVerdictOrders.length > 0 && (
          <div className="mb-4 rounded-lg bg-yesil-soft/30 ring-1 ring-yesil/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-yesil-koyu font-medium">
              ✓ {goodVerdictOrders.length} sipariş tüm dosyaları &ldquo;İYİ&rdquo;
              — toplu onaylanabilir
            </span>
            <Button
              variant="primary"
              size="sm"
              className="!bg-yesil hover:!bg-yesil-koyu"
              onClick={() => void bulkApprove()}
              disabled={deciding}
            >
              Tümünü onayla ({goodVerdictOrders.length})
            </Button>
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { id: null, label: "Tümü", count: queue.length },
            {
              id: "kotu",
              label: "✗ Kötü",
              count: queue.filter((q) => q.qcRuns[0]?.verdict === "kotu").length,
            },
            {
              id: "normal",
              label: "~ Normal",
              count: queue.filter((q) => q.qcRuns[0]?.verdict === "normal")
                .length,
            },
            {
              id: "error",
              label: "! Hata",
              count: queue.filter((q) => q.qcRuns[0]?.verdict === "error").length,
            },
            {
              id: "iyi",
              label: "✓ İyi",
              count: queue.filter((q) => q.qcRuns[0]?.verdict === "iyi").length,
            },
          ]
            .filter((f) => f.count > 0 || f.id === null)
            .map((f) => (
              <button
                key={f.id ?? "all"}
                type="button"
                onClick={() => setVerdictFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors",
                  verdictFilter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          <Card padding="p-2">
            <div className="flex flex-col gap-1">
              {filteredQueue.map((q) => {
                const latestVerdict = q.qcRuns[0]?.verdict;
                const isActive = q.orderId === activeOrderId;
                return (
                  <button
                    key={q.orderId}
                    type="button"
                    onClick={() => setActiveOrderId(q.orderId)}
                    className={cn(
                      "text-left p-3 rounded-lg transition-colors",
                      isActive ? "bg-lacivert text-white" : "hover:bg-gri-100"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[12px] opacity-80">
                        {q.orderId.slice(0, 8)}
                      </span>
                      {latestVerdict && (
                        <span
                          className={cn(
                            "inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-bold",
                            VERDICT_COLORS[latestVerdict] ??
                              VERDICT_COLORS.error
                          )}
                        >
                          {VERDICT_LABELS[latestVerdict] ?? latestVerdict}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-[13px] truncate">
                      {q.customerName}
                    </div>
                    <div
                      className={cn(
                        "text-[11.5px] mt-0.5",
                        isActive ? "text-white/70" : "text-gri-700"
                      )}
                    >
                      {getAdminStatusLabel(q.status)} ·{" "}
                      {timeAgo(q.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card padding="p-6">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 font-mono">
                    {active.orderId}
                  </div>
                  <h2 className="text-xl font-semibold mt-1">
                    {active.customerName}
                  </h2>
                  <div className="text-[13px] text-gri-700 mt-1">{product}</div>
                  <a
                    href={`/admin/siparisler/${active.orderId}#designs`}
                    className="mt-2 inline-flex text-[12px] font-semibold text-pim-mercan hover:underline"
                  >
                    📁 Tüm dosyalar →
                  </a>
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    Sipariş tutarı
                  </div>
                  <div className="text-xl font-bold mt-1 tabular-nums">
                    {fmtTotal(active.total)}
                  </div>
                  <Link
                    href={`/admin/siparisler/${active.orderId}`}
                    className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-pim-mercan hover:underline"
                  >
                    Sipariş detayı →
                  </Link>
                  <div className="text-[12px] text-gri-700 mt-0.5">
                    {timeAgo(active.createdAt)}
                  </div>
                </div>
              </div>
            </Card>

            {active.qcRuns.length > 0 ? (
              <Card padding="p-6">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="font-semibold text-base">
                    AI QC Sonuçları ({active.qcRuns.length} dosya)
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void rerunQc()}
                    disabled={deciding}
                  >
                    🔄 QC tekrar çalıştır
                  </Button>
                </div>

                {active.qcRuns.length > 1 && (
                  <div className="mb-3 rounded-lg bg-mavi-soft/20 ring-1 ring-mavi-koyu/20 px-4 py-2 text-[12.5px]">
                    📊 Bu sipariş için {active.qcRuns.length} QC çalıştırması
                    var (revizyon tespit edildi)
                  </div>
                )}

                {active.qcRuns.length > 1 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {active.qcRuns.slice(0, 2).map((run, idx) => (
                      <div key={run.runId}>
                        <div className="text-[11px] font-bold uppercase mb-2 text-gri-600">
                          {idx === 0 ? "🆕 Son versiyon" : "📄 Önceki versiyon"}
                        </div>
                        <QCRunCard run={run} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {active.qcRuns.map((run) => (
                      <QCRunCard key={run.runId} run={run} />
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card padding="p-6">
                <div className="text-center py-6">
                  <Icon.Box size={40} className="text-gri-500 mx-auto mb-2" />
                  <div className="font-semibold text-lacivert">
                    Tasarım dosyası yok
                  </div>
                  <div className="text-[13px] text-gri-700 mt-1 max-w-[400px] mx-auto leading-relaxed">
                    Müşteri henüz dosya yüklemedi. 3 gün içinde yüklemezse
                    sipariş otomatik geri çekilir.
                  </div>
                </div>
              </Card>
            )}

            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3">Operatör kararı</h3>
              <p className="text-[13px] text-gri-700 mb-3 leading-relaxed">
                <strong>Onayla</strong> → baskıya (<code>ready_to_ship</code>).{" "}
                <strong>Düzelt → Prova</strong> → operatör düzeltir (
                <code>proof_generating</code>). <strong>Reddet</strong> → müşteriye
                düzeltme bildirimi (<code>human_review_failed</code>).
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="İç not (her kararda kaydedilir — operatör notları audit log'a gider)"
                rows={2}
                className="w-full px-3 py-2 mb-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[13px] text-lacivert placeholder:text-gri-500 focus:outline-none focus:ring-pim-mercan focus:bg-white"
              />
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void decide("approve")}
                  disabled={deciding}
                  className="!bg-yesil hover:!bg-yesil-koyu"
                >
                  <Icon.Check size={16} />{" "}
                  {deciding ? "..." : "Onayla → Baskıya"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void decide("fix_and_proof")}
                  disabled={deciding}
                >
                  🔧 Düzelt → Prova hazırla
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void decide("reject")}
                  disabled={deciding}
                  className="!text-kirmizi !ring-kirmizi/30 hover:!bg-kirmizi-soft/20"
                >
                  ✗ Reddet → Müşteriye geri
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
