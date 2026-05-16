/**
 * Pim Etiket — /admin/ai-qc (v2 — Supabase backed)
 *
 * Sefa kuralı (16 May v3 baskı onay akışı):
 *   Müşteri ödeme yapar → Design QC agent fire-and-forget çalışır →
 *   verdict'e göre order.status = "human_review" veya "proof_generating".
 *   Bu sayfa "human_review" / "human_review_failed" siparişlerini sunar,
 *   operatör approve → ready_to_ship, reject → human_review_failed.
 *
 * Migration 039 ile gelen design_quality_checks audit tablosu kullanılır.
 * Eski localStorage prototip kaldırıldı.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

const fmtKurus = (n: number) =>
  (n / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " TL";

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
  createdAt: string;
}

interface QueueItem {
  orderId: string;
  status: string;
  createdAt: string;
  totalKurus: number;
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

const STATUS_LABELS: Record<string, string> = {
  human_review: "Manuel İnceleme",
  human_review_failed: "Reddedildi (müşteriye)",
  proof_generating: "Prova Üretiliyor",
};

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

export default function AdminAiQcPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [note, setNote] = useState("");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-qc/queue", {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; queue?: QueueItem[] };
      if (data.ok && Array.isArray(data.queue)) {
        setQueue(data.queue);
        setActiveIdx((i) =>
          Math.max(0, Math.min(i, data.queue!.length - 1))
        );
      }
    } catch (err) {
      console.error("[ai-qc] queue fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const decide = async (decision: "approve" | "reject") => {
    const order = queue[activeIdx];
    if (!order || deciding) return;
    setDeciding(true);
    try {
      const res = await fetch("/api/admin/ai-qc/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.orderId,
          decision,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        alert(`Karar uygulanamadı: ${data.error ?? "unknown"}`);
        return;
      }
      setNote("");
      await fetchQueue();
    } catch (err) {
      console.error("[ai-qc] decide failed:", err);
      alert("Karar uygulanamadı (ağ hatası)");
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
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

  if (queue.length === 0) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="happy" size={160} />
          <h1 className="mt-4 text-[28px] font-semibold tracking-tight">
            Kuyruk temiz! 🎉
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            Manuel inceleme bekleyen sipariş yok. Yeni QC flag&rsquo;i
            geldiğinde burada görünür.
          </p>
        </div>
      </main>
    );
  }

  const active = queue[activeIdx];
  const product =
    active.items.length === 1
      ? active.items[0].title
      : `${active.items.length} ürün`;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <Eyebrow>AI QC kuyruğu</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Manuel inceleme kuyruğu
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {queue.length} sipariş AI ön kontrolünden geçti, operatör kararı
            bekliyor.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          {/* Queue list */}
          <Card padding="p-2">
            <div className="flex flex-col gap-1">
              {queue.map((q, i) => {
                const latestVerdict = q.qcRuns[0]?.verdict;
                return (
                  <button
                    key={q.orderId}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      "text-left p-3 rounded-lg transition-colors",
                      activeIdx === i
                        ? "bg-lacivert text-white"
                        : "hover:bg-gri-100"
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
                            VERDICT_COLORS[latestVerdict] ?? VERDICT_COLORS.error
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
                        activeIdx === i ? "text-white/70" : "text-gri-700"
                      )}
                    >
                      {STATUS_LABELS[q.status] ?? q.status} ·{" "}
                      {timeAgo(q.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Detail */}
          <div className="flex flex-col gap-4">
            {/* Order header */}
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
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    Sipariş tutarı
                  </div>
                  <div className="text-xl font-bold mt-1 tabular-nums">
                    {fmtKurus(active.totalKurus)}
                  </div>
                  <div className="text-[12px] text-gri-700 mt-0.5">
                    {timeAgo(active.createdAt)}
                  </div>
                </div>
              </div>
            </Card>

            {/* QC Results */}
            {active.qcRuns.length > 0 ? (
              <Card padding="p-6">
                <h3 className="font-semibold text-base mb-3">
                  AI QC Sonuçları ({active.qcRuns.length} dosya)
                </h3>
                <div className="space-y-4">
                  {active.qcRuns.map((run) => (
                    <div
                      key={run.runId}
                      className="rounded-lg ring-1 ring-gri-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] text-lacivert truncate">
                            {run.fileName ?? "—"}
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
                              VERDICT_COLORS[run.verdict] ??
                                VERDICT_COLORS.error
                            )}
                          >
                            {VERDICT_LABELS[run.verdict] ?? run.verdict}
                          </span>
                        </div>
                      </div>
                      {Array.isArray(run.findings) &&
                        run.findings.length > 0 && (
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
                                  <strong className="text-lacivert">
                                    {f.category}:
                                  </strong>{" "}
                                  {f.message}
                                  {f.actionable && (
                                    <em className="block text-gri-700 mt-0.5">
                                      → {f.actionable}
                                    </em>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card padding="p-6">
                <div className="text-center py-6">
                  <Icon.Box
                    size={40}
                    className="text-gri-500 mx-auto mb-2"
                  />
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

            {/* Decision */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3">Operatör kararı</h3>
              <p className="text-[13px] text-gri-700 mb-3 leading-relaxed">
                <strong>Onayla</strong> → sipariş baskıya gönderilir (
                <code>ready_to_ship</code>).{" "}
                <strong>Reddet</strong> → müşteriye düzeltme bildirimi gider (
                <code>human_review_failed</code>).
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Müşteriye iletilecek not (opsiyonel — reddederken faydalı)"
                rows={3}
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
                  onClick={() => void decide("reject")}
                  disabled={deciding}
                >
                  Reddet → Müşteriye geri
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
