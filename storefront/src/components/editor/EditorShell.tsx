"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, useToast } from "@/components/ui";
import {
  EditorCoachmark,
  isEditorOnboarded,
  markEditorOnboarded,
} from "@/components/editor/EditorCoachmark";
import { buildEditorIframeSrc } from "@/lib/editor/build-editor-iframe-src";
import {
  deriveEditorProductHint,
  writeEditorHandoff,
  type PocCutlineMeta,
  type PocDesignFilePayload,
  type PocEditorSavedPayload,
} from "@/lib/editor/editor-handoff";
import { uploadFileToTempDesign } from "@/lib/design-temp-upload";
import { roundEditorMm } from "@/lib/editor/coords";
import {
  effectivePrintDpi,
  printDpiStatus,
} from "@/lib/editor/suggest-mm-from-pixels";
import { DIE_CUT_BY_ID } from "@/lib/templates/die-cut-templates";
import { EditorPreviewLegend } from "@/components/editor/EditorPreviewLegend";
import { cn } from "@/lib/cn";

type PocStatusState = "loading" | "ready" | "loaded" | "error" | "timeout";
type CutMode = "contour" | "hull" | "rect" | "circle";

const CUT_MODES: { mode: CutMode; label: string }[] = [
  { mode: "contour", label: "Kontur" },
  { mode: "hull", label: "Çevresel" },
  { mode: "rect", label: "Dikdörtgen" },
  { mode: "circle", label: "Yuvarlak" },
];

const DEFAULT_WIDTH_MM = 50;
const DEFAULT_HEIGHT_MM = 50;

function base64ToFile(
  base64: string,
  fileName: string,
  mimeType: string
): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

function iframeMaxHeightPx(): number {
  if (typeof window === "undefined") return 720;
  return Math.max(420, window.innerHeight - 168);
}

function capIframeHeight(reported: number): number {
  const max = iframeMaxHeightPx();
  return Math.max(420, Math.min(reported + 8, max));
}

export default function EditorShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sablonPrefilledRef = useRef(false);
  const exportWaitRef = useRef<
    ((payload: PocEditorSavedPayload | null) => void) | null
  >(null);
  const designFileWaitRef = useRef<((file: File | null) => void) | null>(null);
  const pendingSablonRef = useRef<
    | {
        shape: string;
        widthMm: number;
        heightMm: number;
        cornerRadiusMm?: number;
      }
    | null
  >(null);

  const [iframeSrc] = useState(() => buildEditorIframeSrc());
  const [iframeHeight, setIframeHeight] = useState(() => capIframeHeight(720));
  const [designLoaded, setDesignLoaded] = useState(false);
  const [cutlineReady, setCutlineReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [heightMm, setHeightMm] = useState(DEFAULT_HEIGHT_MM);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspect, setAspect] = useState(1);
  const [pocMeta, setPocMeta] = useState<PocCutlineMeta | null>(null);
  const [cutMode, setCutMode] = useState<CutMode>("contour");
  const [imagePixelW, setImagePixelW] = useState(0);
  const [imagePixelH, setImagePixelH] = useState(0);
  const [imageScalePct, setImageScalePct] = useState(100);
  const [pocStatus, setPocStatus] = useState<{
    state: PocStatusState;
    message: string;
  } | null>({ state: "loading", message: "Editör yükleniyor…" });

  useEffect(() => {
    if (!isEditorOnboarded()) setShowCoach(true);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIframeHeight((h) => capIframeHeight(h - 8));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const id = searchParams.get("sablon")?.trim();
    if (!id || sablonPrefilledRef.current) return;
    const tpl = DIE_CUT_BY_ID.get(id);
    if (!tpl) return;
    sablonPrefilledRef.current = true;
    pendingSablonRef.current = {
      shape: tpl.shape,
      widthMm: tpl.widthMm,
      heightMm: tpl.heightMm,
      cornerRadiusMm: tpl.cornerRadiusMm,
    };
    setWidthMm(tpl.widthMm);
    setHeightMm(tpl.heightMm);
    setAspect(tpl.widthMm / tpl.heightMm);
    setCutMode(
      tpl.shape === "circle"
        ? "circle"
        : tpl.shape === "rect" || tpl.shape === "ellipse"
          ? "rect"
          : "contour"
    );
  }, [searchParams]);

  const postToPoc = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      payload,
      window.location.origin
    );
  }, []);

  const syncSizeToPoc = useCallback(
    (w: number, h: number) => {
      postToPoc({ type: "pim-editor-set-size", widthMm: w, heightMm: h });
    },
    [postToPoc]
  );

  const applyPendingSablon = useCallback(() => {
    const tpl = pendingSablonRef.current;
    if (!tpl || !iframeRef.current?.contentWindow) return;
    const mode =
      tpl.shape === "circle"
        ? "circle"
        : tpl.shape === "rect" || tpl.shape === "ellipse"
          ? "rect"
          : "contour";
    postToPoc({
      type: "pim-editor-set-shape",
      shape: tpl.shape,
      mode,
      widthMm: tpl.widthMm,
      heightMm: tpl.heightMm,
      cornerRadiusMm: tpl.cornerRadiusMm ?? 0,
    });
    syncSizeToPoc(tpl.widthMm, tpl.heightMm);
    pendingSablonRef.current = null;
  }, [postToPoc, syncSizeToPoc]);

  useEffect(() => {
    let timeoutHandle: number | null = null;
    let loaded = false;

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = e.data as Record<string, unknown> | undefined;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "pim-poc-ready") {
        setPocStatus({ state: "ready", message: "Görsel yükle — bıçak otomatik netleşir" });
        syncSizeToPoc(widthMm, heightMm);
        applyPendingSablon();
      } else if (data.type === "pim-poc-loading") {
        setDesignLoaded(false);
        setCutlineReady(false);
        setImageScalePct(100);
      } else if (data.type === "pim-poc-loaded") {
        loaded = true;
        setDesignLoaded(true);
        if (typeof data.width === "number" && data.width > 0) {
          setImagePixelW(data.width);
        }
        if (typeof data.height === "number" && data.height > 0) {
          setImagePixelH(data.height);
        }
        setPocStatus({
          state: "loaded",
          message: "Tasarım yüklendi — kontur hesaplanıyor…",
        });
      } else if (data.type === "pim-image-scale-changed") {
        if (typeof data.scale === "number" && data.scale > 0) {
          setImageScalePct(
            Math.round(Math.max(25, Math.min(200, data.scale * 100)))
          );
        }
      } else if (data.type === "pim-cutline-ready") {
        setCutlineReady(true);
        const meta = data.meta as PocCutlineMeta | undefined;
        if (meta) {
          setPocMeta((prev) => ({ ...prev, ...meta }));
          if (
            meta.mode === "contour" ||
            meta.mode === "hull" ||
            meta.mode === "rect" ||
            meta.mode === "circle"
          ) {
            setCutMode(meta.mode);
          }
          if (typeof meta.width_mm === "number" && meta.width_mm > 0) {
            setWidthMm(meta.width_mm);
          }
          if (typeof meta.height_mm === "number" && meta.height_mm > 0) {
            setHeightMm(meta.height_mm);
          }
        }
        setPocStatus({
          state: "loaded",
          message: "Bıçak hazır — ürüne ekleyebilirsin",
        });
        window.setTimeout(() => setPocStatus(null), 2500);
      } else if (data.type === "pim-poc-error") {
        setPocStatus({
          state: "error",
          message: `Editör hatası: ${String(data.error ?? "(boş)")}`,
        });
      } else if (
        data.type === "pim-poc-resize" &&
        typeof data.height === "number"
      ) {
        setIframeHeight(capIframeHeight(data.height));
      } else if (data.type === "pim-editor-saved") {
        const payload = data as unknown as PocEditorSavedPayload;
        setPocMeta(payload.meta);
        exportWaitRef.current?.(payload);
        exportWaitRef.current = null;
      } else if (data.type === "pim-design-file") {
        const filePayload = data as unknown as PocDesignFilePayload;
        if (filePayload.error || !filePayload.base64 || !filePayload.fileName) {
          designFileWaitRef.current?.(null);
          designFileWaitRef.current = null;
          return;
        }
        try {
          const file = base64ToFile(
            filePayload.base64,
            filePayload.fileName,
            filePayload.mimeType || "application/octet-stream"
          );
          designFileWaitRef.current?.(file);
        } catch {
          designFileWaitRef.current?.(null);
        }
        designFileWaitRef.current = null;
      }
    };

    window.addEventListener("message", handler);
    timeoutHandle = window.setTimeout(() => {
      if (!loaded) {
        setPocStatus((prev) =>
          prev?.state === "loaded"
            ? prev
            : {
                state: "timeout",
                message:
                  "Editör yanıt vermedi. Sayfayı yenileyip tekrar deneyin.",
              }
        );
      }
    }, 120_000);

    return () => {
      window.removeEventListener("message", handler);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, [applyPendingSablon, syncSizeToPoc, widthMm, heightMm]);

  useEffect(() => {
    if (!designLoaded || cutlineReady) return;
    const fallback = window.setTimeout(() => {
      setCutlineReady(true);
      setPocStatus((prev) =>
        prev?.state === "loaded" && prev.message.includes("hesaplanıyor")
          ? { state: "loaded", message: "Bıçak hazır — ürüne ekleyebilirsin" }
          : prev
      );
    }, 4000);
    return () => window.clearTimeout(fallback);
  }, [designLoaded, cutlineReady]);

  const productHint = useMemo(
    () => deriveEditorProductHint(pocMeta),
    [pocMeta]
  );

  const ctaBlockedReason = useMemo(() => {
    if (saving) return "Kaydediliyor…";
    if (!designLoaded) return "Önce görsel yükle";
    if (!cutlineReady) return "Bıçak hazırlanıyor…";
    return null;
  }, [saving, designLoaded, cutlineReady]);

  const handleWidthChange = (raw: number) => {
    const w = roundEditorMm(raw);
    setWidthMm(w);
    const h = lockAspect && aspect > 0 ? roundEditorMm(w / aspect) : heightMm;
    if (lockAspect && aspect > 0) setHeightMm(h);
    syncSizeToPoc(w, h);
  };

  const handleHeightChange = (raw: number) => {
    const h = roundEditorMm(raw);
    setHeightMm(h);
    const w = lockAspect && aspect > 0 ? roundEditorMm(h * aspect) : widthMm;
    if (lockAspect && aspect > 0) setWidthMm(w);
    syncSizeToPoc(w, h);
  };

  const handleLockAspectChange = (on: boolean) => {
    if (on && heightMm > 0) setAspect(widthMm / heightMm);
    setLockAspect(on);
  };

  const handleCutModeChange = (mode: CutMode) => {
    setCutMode(mode);
    setCutlineReady(false);
    postToPoc({
      type: "pim-editor-set-shape",
      mode,
      widthMm,
      heightMm,
    });
  };

  const handleImageScaleChange = (pct: number) => {
    const clamped = Math.max(25, Math.min(200, pct));
    setImageScalePct(clamped);
    postToPoc({ type: "pim-set-image-scale", scale: clamped / 100 });
  };

  const dpiInfo = useMemo(() => {
    if (imagePixelW <= 0 || imagePixelH <= 0) return null;
    const dpi = effectivePrintDpi(
      imagePixelW,
      imagePixelH,
      widthMm,
      heightMm
    );
    return printDpiStatus(dpi);
  }, [imagePixelW, imagePixelH, widthMm, heightMm]);

  const requestDesignFile = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      designFileWaitRef.current = resolve;
      postToPoc({ type: "pim-request-design-file" });
      window.setTimeout(() => {
        if (designFileWaitRef.current) {
          designFileWaitRef.current(null);
          designFileWaitRef.current = null;
        }
      }, 20_000);
    });
  }, [postToPoc]);

  const requestExport = useCallback((): Promise<PocEditorSavedPayload | null> => {
    return new Promise((resolve) => {
      exportWaitRef.current = resolve;
      postToPoc({ type: "pim-request-export" });
      window.setTimeout(() => {
        if (exportWaitRef.current) {
          exportWaitRef.current(null);
          exportWaitRef.current = null;
        }
      }, 20_000);
    });
  }, [postToPoc]);

  const persistDraft = useCallback(
    async (
      tempDesignId: string,
      payload: PocEditorSavedPayload
    ): Promise<string | null> => {
      const meta = payload.meta;
      const res = await fetch("/api/editor/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tempDesignId,
          svg: payload.svg,
          preview_png_base64: payload.preview_png_base64 ?? undefined,
          source: meta.source ?? "raster",
          mode: meta.mode ?? "contour",
          offset_mm: meta.offset_mm,
          smoothness: meta.smoothness,
          width_mm: meta.width_mm ?? widthMm,
          height_mm: meta.height_mm ?? heightMm,
          cutline_width_mm: meta.cutline_width_mm,
          cutline_height_mm: meta.cutline_height_mm,
          material_type: meta.material_type ?? "paper",
          placement_json: meta.image_placement,
        }),
      });
      const data = (await res.json()) as { draftId?: string; error?: string };
      if (!res.ok || !data.draftId) {
        toast.error(data.error ?? "Bıçak kaydı başarısız");
        return null;
      }
      return data.draftId;
    },
    [toast, widthMm, heightMm]
  );

  const addToProduct = async (product: "sticker" | "etiket") => {
    if (ctaBlockedReason) {
      toast.info(ctaBlockedReason);
      return;
    }
    if (!iframeRef.current) return;

    setSaving(true);
    try {
      const exported = await requestExport();
      if (!exported?.svg) {
        toast.error("Bıçak dışa aktarılamadı — tekrar dene");
        return;
      }
      setPocMeta(exported.meta);

      const file = await requestDesignFile();
      if (!file) {
        toast.error("Tasarım dosyası alınamadı");
        return;
      }

      const uploaded = await uploadFileToTempDesign(file);
      if (!uploaded) {
        toast.error("Tasarım yüklenemedi");
        return;
      }

      const resolvedDraftId = await persistDraft(uploaded.tempId, exported);
      if (!resolvedDraftId) return;

      writeEditorHandoff({
        tempId: uploaded.tempId,
        previewUrl: uploaded.generatedPreviewUrl ?? uploaded.previewUrl,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        editorCutlineDraftId: resolvedDraftId,
        widthMm: exported.meta.width_mm ?? widthMm,
        heightMm: exported.meta.height_mm ?? heightMm,
      });

      router.push(
        product === "etiket"
          ? "/etiket/yapilandir?from=editor"
          : "/sticker/yapilandir?from=editor"
      );
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = useMemo(() => {
    const s = pocMeta?.source;
    if (s === "vector") return "Vektörel";
    if (s === "vector-with-cutline") return "Vektörel + bıçak";
    if (s === "psd") return "PSD";
    if (designLoaded) return "Raster";
    return "—";
  }, [pocMeta?.source, designLoaded]);

  return (
    <main
      className="editor-workspace flex h-[calc(100dvh-56px)] flex-col overflow-hidden bg-gri-50"
      data-editor-workspace
    >
      <EditorCoachmark
        open={showCoach}
        onComplete={() => {
          markEditorOnboarded();
          setShowCoach(false);
        }}
        onDismissSession={() => setShowCoach(false)}
      />

      <header className="z-30 flex shrink-0 flex-wrap items-center gap-3 border-b border-gri-200 bg-white px-4 py-3 shadow-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] md:text-[17px] font-semibold tracking-tight text-lacivert">
            Bıçak & baskı hazırlama
          </h1>
          <p className="mt-0.5 text-[12px] text-gri-600 leading-snug">
            Görsel yükle, boyutu ayarla, ürüne ekle.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1" data-onboard="export">
          {productHint.message ? (
            <p className="text-[10px] text-gri-500 leading-snug text-right max-w-[220px]">
              {productHint.message}
            </p>
          ) : null}
          {ctaBlockedReason ? (
            <p className="text-[11px] text-gri-600">{ctaBlockedReason}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={
                productHint.primary === "sticker" ? "primary" : "secondary"
              }
              size="sm"
              disabled={!!ctaBlockedReason}
              onClick={() => void addToProduct("sticker")}
            >
              Sticker&apos;a ekle
            </Button>
            <Button
              type="button"
              variant={
                productHint.primary === "etiket" ? "primary" : "secondary"
              }
              size="sm"
              disabled={!!ctaBlockedReason}
              onClick={() => void addToProduct("etiket")}
            >
              Etiket&apos;e ekle
            </Button>
          </div>
        </div>
      </header>

      {pocStatus ? (
        <div
          className={cn(
            "mx-4 mt-2 shrink-0 rounded-xl border px-3 py-1.5 text-[12px]",
            pocStatus.state === "error" || pocStatus.state === "timeout"
              ? "border-kirmizi/40 bg-kirmizi-soft text-kirmizi"
              : pocStatus.state === "loaded"
                ? "border-yesil/40 bg-yesil-soft text-yesil"
                : pocStatus.state === "ready"
                  ? "border-pim-mercan/40 bg-pim-mercan-tint text-lacivert"
                  : "border-sari/40 bg-sari-soft text-lacivert"
          )}
        >
          {pocStatus.message}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
        <aside className="shrink-0 border-b border-gri-200 bg-white px-4 py-3 lg:w-[280px] lg:border-b-0 lg:border-r">
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gri-600">
              Baskı boyutu
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-gri-600">
                Genişlik (mm)
                <Input
                  type="number"
                  min={5}
                  max={500}
                  step={0.1}
                  value={widthMm}
                  className="mt-1"
                  onChange={(e) =>
                    handleWidthChange(parseFloat(e.target.value) || DEFAULT_WIDTH_MM)
                  }
                />
              </label>
              <label className="block text-[11px] text-gri-600">
                Yükseklik (mm)
                <Input
                  type="number"
                  min={5}
                  max={500}
                  step={0.1}
                  value={heightMm}
                  className="mt-1"
                  onChange={(e) =>
                    handleHeightChange(parseFloat(e.target.value) || DEFAULT_HEIGHT_MM)
                  }
                />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[12px] text-gri-700">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => handleLockAspectChange(e.target.checked)}
                className="accent-pim-mercan"
              />
              Oran kilidi
            </label>
            <p className="mt-2 text-[12px] tabular-nums text-gri-800">
              {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm
            </p>
          </section>

          <section className="mt-4 border-t border-gri-100 pt-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gri-600">
              Görsel ölçek
            </h2>
            <label className="mt-2 block text-[11px] text-gri-600">
              <span className="flex items-center justify-between gap-2">
                <span>Ölçek</span>
                <span className="tabular-nums font-medium text-lacivert">
                  %{imageScalePct}
                </span>
              </span>
              <input
                type="range"
                min={25}
                max={200}
                step={1}
                value={imageScalePct}
                disabled={!designLoaded}
                onChange={(e) =>
                  handleImageScaleChange(parseInt(e.target.value, 10))
                }
                className="mt-1.5 w-full accent-pim-mercan disabled:opacity-40"
              />
            </label>
            <p className="mt-1 text-[10px] text-gri-500 leading-snug">
              %25–%200 arası. Ortala / Sığdır / Doldur ile sıfırlanır.
            </p>
          </section>

          <section className="mt-4 border-t border-gri-100 pt-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gri-600">
              Özet
            </h2>
            <dl className="mt-2 space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-gri-600">Kaynak</dt>
                <dd className="font-medium text-lacivert">{sourceLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gri-600">Baskı boyutu</dt>
                <dd className="font-medium tabular-nums text-lacivert">
                  {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gri-600">Bıçak</dt>
                <dd
                  className={cn(
                    "font-medium",
                    cutlineReady ? "text-yesil" : "text-gri-500"
                  )}
                >
                  {cutlineReady ? "Hazır" : designLoaded ? "Hesaplanıyor…" : "—"}
                </dd>
              </div>
              {dpiInfo ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gri-600">Baskı DPI</dt>
                  <dd
                    className={cn(
                      "font-medium tabular-nums text-right",
                      dpiInfo.level === "ok"
                        ? "text-yesil"
                        : dpiInfo.level === "warn"
                          ? "text-sari"
                          : "text-kirmizi"
                    )}
                  >
                    ≈{dpiInfo.dpi}
                  </dd>
                </div>
              ) : null}
            </dl>
            {dpiInfo?.message ? (
              <p
                className={cn(
                  "mt-2 rounded-lg px-2 py-1.5 text-[11px] leading-snug",
                  dpiInfo.level === "warn"
                    ? "bg-sari-soft text-lacivert"
                    : "bg-kirmizi-soft text-kirmizi"
                )}
              >
                {dpiInfo.level === "ok"
                  ? "Baskı kalitesi iyi"
                  : dpiInfo.message}
              </p>
            ) : dpiInfo?.level === "ok" ? (
              <p className="mt-2 text-[11px] text-yesil">Baskı kalitesi iyi</p>
            ) : null}
          </section>

          <p className="mt-4 text-[11px] text-gri-600 leading-snug">
            Kesim mesafesi ve katmanlar önizleme içinde.{" "}
            <Link href="/sablonlar?tab=kesim" className="text-pim-mercan underline">
              Kesim şablonları
            </Link>
          </p>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3 lg:p-4">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gri-200 bg-white p-1">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gri-500">
                Yerleştir
              </span>
              {(
                [
                  { id: "pim-fit-center", label: "Ortala" },
                  { id: "pim-fit-contain", label: "Sığdır" },
                  { id: "pim-fit-cover", label: "Doldur" },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  disabled={!designLoaded}
                  onClick={() => postToPoc({ type: btn.id })}
                  className="rounded-md px-2.5 py-1 text-[12px] font-medium text-gri-700 hover:bg-gri-100 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gri-200 bg-white p-1">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gri-500">
                Kesim
              </span>
              {CUT_MODES.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!designLoaded}
                  onClick={() => handleCutModeChange(mode)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
                    cutMode === mode
                      ? "bg-pim-mercan text-white shadow-sm"
                      : "text-gri-700 hover:bg-gri-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <EditorPreviewLegend />

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gri-200 bg-white shadow-sm">
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Bıçak editörü"
              className="block h-full w-full min-h-[420px] border-0"
              style={{ height: iframeHeight, maxHeight: iframeMaxHeightPx() }}
              scrolling="no"
              sandbox="allow-scripts allow-same-origin allow-downloads"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
