/**
 * Pim Etiket — /admin/debug/design-qc-test
 *
 * Design Quality Check Agent için manuel test arayüzü.
 * Sefa kuralı (16 May 2026): admin/staff bir tasarım dosyası seç,
 * boyut ver, "Test et" → AI sonucu görür.
 *
 * Akış:
 *   1. design_files listesini /api/admin/designs ile çek
 *   2. Dropdown'dan dosya seç
 *   3. Hedef baskı boyutu input (default 60×80)
 *   4. Ürün tipi seç (etiket/sticker)
 *   5. "Agent çalıştır" tıkla → POST /api/agents/design-qc
 *   6. Sonuç (verdict, score, findings, telemetry) render
 */

"use client";

import { useEffect, useState } from "react";
import { Card, Button, Pill, Eyebrow } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

interface AdminDesignRow {
  id: string;
  orderId: string;
  customerName: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  status: string;
  previewUrl: string | null;
  uploadedAt: string;
}

interface QCResult {
  ok: boolean;
  runId?: string;
  fileId: string;
  fileName: string;
  verdict: "iyi" | "normal" | "kotu" | "error";
  score?: number;
  fileType?: string;
  effectiveDpi?: number | null;
  findings?: Array<{
    severity: "info" | "warning" | "error";
    category: string;
    message: string;
    actionable?: string;
  }>;
  analysis?: {
    colorProfile?: string | null;
    hasBleed?: boolean | null;
    hasCutPath?: boolean | null;
    isTextOutlined?: boolean | null;
    visualQuality?: string | null;
    embeddedRasterCount?: number;
  };
  telemetry?: {
    durationMs: number;
    model: string;
    costUsd?: number;
  };
  error?: string;
}

const VERDICT_META: Record<
  string,
  { label: string; emoji: string; color: string; bg: string }
> = {
  iyi: {
    label: "İYİ",
    emoji: "",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
  normal: {
    label: "NORMAL",
    emoji: "",
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
  },
  kotu: {
    label: "KÖTÜ",
    emoji: "",
    color: "text-kirmizi",
    bg: "bg-kirmizi/10",
  },
  error: {
    label: "HATA",
    emoji: "",
    color: "text-gri-700",
    bg: "bg-gri-100",
  },
};

const SEVERITY_META: Record<
  string,
  { color: string; bg: string; emoji: string }
> = {
  info: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint", emoji: "" },
  warning: { color: "text-sari-koyu", bg: "bg-sari-soft", emoji: "" },
  error: { color: "text-kirmizi", bg: "bg-kirmizi/10", emoji: "" },
};

export default function DesignQcTestPage() {
  const [designs, setDesigns] = useState<AdminDesignRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [widthMm, setWidthMm] = useState(60);
  const [heightMm, setHeightMm] = useState(80);
  const [productType, setProductType] = useState<"etiket" | "sticker">(
    "etiket"
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QCResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load designs list
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/designs?limit=50");
        const data = (await res.json()) as { designs?: AdminDesignRow[] };
        if (data.designs && data.designs.length > 0) {
          setDesigns(data.designs);
          setSelectedId(data.designs[0].id);
        }
      } catch (err) {
        console.error("[design-qc-test] designs load error:", err);
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  const selectedFile = designs.find((d) => d.id === selectedId) ?? null;

  const handleRun = async () => {
    if (!selectedId) {
      setError("Önce bir dosya seç");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/agents/design-qc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: selectedId,
          printWidthMm: widthMm,
          printHeightMm: heightMm,
          productType,
        }),
      });
      const data = (await res.json()) as QCResult & {
        error?: string;
        detail?: string;
      };

      if (!res.ok || !data.ok) {
        setError(
          data.error
            ? `${data.error}${data.detail ? ` — ${data.detail}` : ""}`
            : "Bilinmeyen hata"
        );
        return;
      }
      setResult(data);
    } catch (err) {
      setError(
        `Network hatası: ${err instanceof Error ? err.message : "unknown"}`
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-4 rounded-lg border border-sari bg-sari-soft px-4 py-3 text-sm text-lacivert">
           Bu sayfa geliştirici test aracıdır — gerçek sipariş QC işlemleri için{" "}
          <a href="/admin/ai-qc" className="underline font-medium">
            AI QC Kuyruğu
          </a>
          &apos;nu kullanın.
        </div>

        <div className="mb-6">
          <Eyebrow>Agent Testi</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Design Quality Check
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            AI ile tasarım dosyalarını analiz et — kötü/normal/iyi karar
            mekanizması.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* SOL — Input form */}
          <Card padding="p-6">
            <h2 className="font-semibold text-lg mb-4">Test Parametreleri</h2>

            {/* Dosya seçimi */}
            <label className="block mb-4">
              <span className="text-[13px] font-semibold text-gri-700 mb-1.5 block">
                Tasarım dosyası
                {loadingList && (
                  <span className="ml-2 text-gri-500 font-normal">
                    yükleniyor…
                  </span>
                )}
              </span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loadingList || designs.length === 0}
                className="block w-full h-11 px-3 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan"
              >
                {designs.length === 0 && !loadingList ? (
                  <option value="">Hiç dosya yok</option>
                ) : (
                  designs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.originalName} · {d.customerName} · {d.orderId.slice(-6)}
                    </option>
                  ))
                )}
              </select>
            </label>

            {/* Preview thumbnail */}
            {selectedFile?.previewUrl && (
              <div className="mb-4 p-3 rounded-xl bg-gri-50 ring-1 ring-gri-200">
                <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-gri-700 mb-2">
                  Önizleme
                </div>
                <div className="aspect-square max-w-[200px] mx-auto bg-white rounded-lg overflow-hidden ring-1 ring-gri-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedFile.previewUrl}
                    alt={selectedFile.originalName}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="mt-2 text-[12px] text-gri-700 text-center">
                  {selectedFile.mimeType} ·{" "}
                  {(selectedFile.sizeBytes / 1024).toFixed(0)} KB
                </div>
              </div>
            )}

            {/* Boyut */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[13px] font-semibold text-gri-700 mb-1.5 block">
                  Genişlik (mm)
                </span>
                <input
                  type="number"
                  value={widthMm}
                  onChange={(e) =>
                    setWidthMm(Math.max(5, Number(e.target.value) || 5))
                  }
                  min={5}
                  max={1500}
                  className="block w-full h-11 px-3 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-gri-700 mb-1.5 block">
                  Yükseklik (mm)
                </span>
                <input
                  type="number"
                  value={heightMm}
                  onChange={(e) =>
                    setHeightMm(Math.max(5, Number(e.target.value) || 5))
                  }
                  min={5}
                  max={1500}
                  className="block w-full h-11 px-3 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                />
              </label>
            </div>

            {/* Ürün tipi */}
            <label className="block mb-5">
              <span className="text-[13px] font-semibold text-gri-700 mb-1.5 block">
                Ürün tipi
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["etiket", "sticker"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setProductType(t)}
                    aria-pressed={productType === t}
                    className={cn(
                      "h-11 rounded-xl text-[14px] font-semibold ring-1 transition-all",
                      productType === t
                        ? "bg-pim-mercan-tint ring-pim-mercan text-pim-mercan"
                        : "bg-white ring-gri-200 text-gri-700 hover:ring-pim-mercan"
                    )}
                  >
                    {t === "etiket" ? "Etiket" : "Sticker"}
                  </button>
                ))}
              </div>
            </label>

            {/* Çalıştır */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleRun}
              disabled={running || !selectedId}
              className="w-full"
            >
              {running ? "Agent çalışıyor…" : "Agent'ı çalıştır"}
              {!running && <Icon.ArrowR size={16} />}
            </Button>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-kirmizi/10 ring-1 ring-kirmizi/30 text-[13px] text-kirmizi">
                 {error}
              </div>
            )}
          </Card>

          {/* SAĞ — Sonuç */}
          <Card padding="p-6">
            {!result ? (
              <div className="text-center py-12">
                <Icon.Sparkle
                  size={48}
                  className="text-gri-300 mx-auto mb-3"
                />
                <p className="text-[13px] text-gri-700">
                  Sol panelden parametreleri seç, agent'ı çalıştır.
                </p>
              </div>
            ) : (
              <>
                {/* Verdict */}
                <div
                  className={cn(
                    "rounded-xl p-5 mb-5 text-center",
                    VERDICT_META[result.verdict]?.bg ?? "bg-gri-100"
                  )}
                >
                  <div className="text-5xl mb-2">
                    {VERDICT_META[result.verdict]?.emoji}
                  </div>
                  <div
                    className={cn(
                      "text-2xl font-bold uppercase tracking-wide",
                      VERDICT_META[result.verdict]?.color
                    )}
                  >
                    {VERDICT_META[result.verdict]?.label}
                  </div>
                  {typeof result.score === "number" && (
                    <div className="mt-2 text-3xl font-bold tabular-nums text-lacivert">
                      {result.score}
                      <span className="text-[14px] text-gri-700 ml-1">
                        / 100
                      </span>
                    </div>
                  )}
                </div>

                {/* Kısa özet */}
                <div className="grid grid-cols-2 gap-3 mb-5 text-[12.5px]">
                  <div className="p-2.5 rounded-lg bg-gri-50">
                    <div className="font-bold uppercase tracking-[0.06em] text-[10.5px] text-gri-700">
                      Tip
                    </div>
                    <div className="mt-0.5 text-lacivert">
                      {result.fileType ?? "—"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gri-50">
                    <div className="font-bold uppercase tracking-[0.06em] text-[10.5px] text-gri-700">
                      Effective DPI
                    </div>
                    <div className="mt-0.5 text-lacivert">
                      {result.effectiveDpi ?? "N/A (vektörel)"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gri-50">
                    <div className="font-bold uppercase tracking-[0.06em] text-[10.5px] text-gri-700">
                      Renk Profili
                    </div>
                    <div className="mt-0.5 text-lacivert">
                      {result.analysis?.colorProfile ?? "—"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gri-50">
                    <div className="font-bold uppercase tracking-[0.06em] text-[10.5px] text-gri-700">
                      Bleed
                    </div>
                    <div className="mt-0.5 text-lacivert">
                      {result.analysis?.hasBleed === true
                        ? " Var"
                        : result.analysis?.hasBleed === false
                          ? " Yok"
                          : "—"}
                    </div>
                  </div>
                </div>

                {/* Findings */}
                {result.findings && result.findings.length > 0 && (
                  <div className="mb-5">
                    <div className="font-bold uppercase tracking-[0.06em] text-[10.5px] text-gri-700 mb-2">
                      Bulgular ({result.findings.length})
                    </div>
                    <div className="space-y-2">
                      {result.findings.map((f, i) => {
                        const meta =
                          SEVERITY_META[f.severity] ?? SEVERITY_META.info;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "p-3 rounded-lg ring-1 text-[12.5px]",
                              meta.bg,
                              "ring-" + meta.color.replace("text-", "")
                            )}
                          >
                            <div
                              className={cn(
                                "font-semibold flex items-start gap-1.5",
                                meta.color
                              )}
                            >
                              <span>{meta.emoji}</span>
                              <span>{f.message}</span>
                            </div>
                            {f.actionable && (
                              <div className="mt-1.5 text-gri-700 pl-5">
                                 <strong>Çözüm:</strong> {f.actionable}
                              </div>
                            )}
                            <div className="mt-1 text-[10.5px] text-gri-500 uppercase tracking-[0.04em] pl-5">
                              {f.category}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Telemetry */}
                {result.telemetry && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <Pill>⏱ {result.telemetry.durationMs}ms</Pill>
                    <Pill> {result.telemetry.model}</Pill>
                    {result.telemetry.costUsd !== undefined && (
                      <Pill> ${result.telemetry.costUsd.toFixed(4)}</Pill>
                    )}
                    {result.runId && (
                      <Pill> {result.runId.slice(0, 8)}</Pill>
                    )}
                  </div>
                )}

                {/* JSON detay */}
                <details className="mt-5">
                  <summary className="cursor-pointer text-[12px] font-semibold text-gri-700">
                    JSON detay (geliştirici)
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-lacivert text-yesil text-[11px] overflow-auto max-h-[300px]">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </Card>
        </div>

        {/* Hızlı bilgi */}
        <Card padding="p-5" className="mt-6 !bg-krem">
          <div className="flex items-start gap-3">
            <span className="text-2xl"></span>
            <div className="text-[13px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">Test ipuçları:</strong>
              <ul className="mt-1.5 space-y-1 list-disc list-inside">
                <li>
                  Aynı dosya için farklı baskı boyutları dene → effective DPI
                  ebatla değişir
                </li>
                <li>
                  Küçük dosya × büyük baskı = kötü skor (örn 500×500px → 200×200mm)
                </li>
                <li>
                  Büyük dosya × küçük baskı = iyi skor (örn 2000×2000px → 50×50mm)
                </li>
                <li>
                  PDF/AI/EPS gibi vektörel formatlar şu an MVP'de auto-pass
                  (uzman gözüne yönlendirilir)
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
