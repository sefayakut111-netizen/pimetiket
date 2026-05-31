"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DesignDropZone,
  type DesignTempState,
} from "@/components/ui/DesignDropZone";
import {
  EditorCanvas,
  type EditorCanvasHandle,
} from "@/components/editor/EditorCanvas";
import {
  EditorLayerToggles,
  EditorZoomControls,
  type EditorLayer,
} from "@/components/editor/EditorPreviewToolbar";
import {
  EditorCanvasHint,
  isCanvasHintSeen,
  markCanvasHintSeen,
} from "@/components/editor/EditorCanvasHint";
import {
  EditorCoachmark,
  isEditorOnboarded,
  markEditorOnboarded,
} from "@/components/editor/EditorCoachmark";
import { CutColorNote } from "@/components/editor/CutColorNote";
import { ShapePreview } from "@/components/templates/ShapePreview";
import { Button, Input, Pill, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { preloadContourWorker } from "@/lib/editor/cutline/contour-worker-client";
import { writeEditorHandoff } from "@/lib/editor/editor-handoff";
import { suggestMmFromPixels } from "@/lib/editor/suggest-mm-from-pixels";
import {
  CATEGORY_LABELS,
  DIE_CUT_BY_ID,
  DIE_CUT_TEMPLATES,
  type DieCutTemplate,
  type ShapeCategory,
} from "@/lib/templates/die-cut-templates";
import type { BgDetectResult } from "@/lib/proof/background-detect";
import type { BladeShapeConfig } from "@/lib/editor/pikaso/controller-types";
import type { CutlineMode } from "@/lib/editor/cutline/types";

const CANVAS_HEIGHT = 520;

type BladeTab = "template" | "auto";
type LeftPanel = "file" | "blade";

const DEFAULT_LAYERS: Record<EditorLayer, boolean> = {
  cut: true,
  white: false,
  bleed: false,
  safe: false,
};

export default function EditorShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const sablonPrefilledRef = useRef(false);
  const canvasReadyRef = useRef(false);
  const pendingShapeRef = useRef<DieCutTemplate | "contour" | null>(null);
  const exportWaitRef = useRef<((id: string | null) => void) | null>(null);
  const skipDimResetRef = useRef(false);
  const pendingSavePromiseRef = useRef<Promise<string | null> | null>(null);

  const [leftPanel, setLeftPanel] = useState<LeftPanel>("file");
  const [bladeSearch, setBladeSearch] = useState("");
  const [design, setDesign] = useState<DesignTempState | null>(null);
  const [widthMm, setWidthMm] = useState(50);
  const [heightMm, setHeightMm] = useState(50);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspect, setAspect] = useState(1);
  const [offsetMm, setOffsetMm] = useState(2);
  const [viewZoom, setViewZoom] = useState(1);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [bladeTab, setBladeTab] = useState<BladeTab>("template");
  const [category, setCategory] = useState<ShapeCategory | "all">("all");
  const [selectedTpl, setSelectedTpl] = useState<DieCutTemplate | null>(null);
  const [bgDetect, setBgDetect] = useState<BgDetectResult | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const dimsAppliedRef = useRef<string | null>(null);
  const prevDesignRef = useRef<DesignTempState | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showCanvasHint, setShowCanvasHint] = useState(false);
  const [contourRefining, setContourRefining] = useState(false);

  useEffect(() => {
    if (!isEditorOnboarded()) setShowCoach(true);
  }, []);

  useEffect(() => {
    if (!prevDesignRef.current && design) {
      setLeftPanel("blade");
    }
    prevDesignRef.current = design;
  }, [design]);

  useEffect(() => {
    if (!design?.tempId || isCanvasHintSeen()) return;
    setShowCanvasHint(true);
  }, [design?.tempId]);

  const dismissCanvasHint = useCallback(() => {
    setShowCanvasHint((v) => {
      if (v) markCanvasHintSeen();
      return false;
    });
  }, []);

  useEffect(() => {
    if (skipDimResetRef.current) {
      skipDimResetRef.current = false;
      dimsAppliedRef.current = design?.tempId ?? null;
      return;
    }
    dimsAppliedRef.current = null;
  }, [design?.tempId]);
  useEffect(() => {
    if (!design?.tempId) return;
    void preloadContourWorker();
  }, [design?.tempId]);

  useEffect(() => {
    if (!design) {
      setDesignUrl(null);
      setCanvasMounted(false);
      canvasReadyRef.current = false;
      setContourRefining(false);
      return;
    }
    setDesignUrl(
      `${window.location.origin}/api/editor/design-file/${design.tempId}`
    );
    setCanvasMounted(true);
    canvasReadyRef.current = false;
  }, [design?.tempId]);

  useEffect(() => {
    if (!design?.tempId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/editor/background?tempDesignId=${design.tempId}`
        );
        const data = (await res.json()) as { detect?: BgDetectResult };
        if (!cancelled && data.detect) setBgDetect(data.detect);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design?.tempId]);

  const bladeShape = useMemo((): BladeShapeConfig => {
    if (selectedTpl) {
      const mode: CutlineMode =
        selectedTpl.shape === "circle"
          ? "circle"
          : selectedTpl.shape === "rect" || selectedTpl.shape === "ellipse"
            ? "rect"
            : "contour";
      return { kind: "template", template: selectedTpl, mode };
    }
    if (bladeTab === "auto") {
      return { kind: "contour" };
    }
    return { kind: "none" };
  }, [selectedTpl, bladeTab]);

  const applyTemplate = useCallback((tpl: DieCutTemplate) => {
    setSelectedTpl(tpl);
    setWidthMm(tpl.widthMm);
    setHeightMm(tpl.heightMm);
    setAspect(tpl.widthMm / tpl.heightMm);
    pendingShapeRef.current = tpl;
  }, []);

  const flushPendingShape = useCallback(() => {
    if (!canvasReadyRef.current || !pendingShapeRef.current) return;
    const pending = pendingShapeRef.current;
    pendingShapeRef.current = null;
    if (pending === "contour") {
      setSelectedTpl(null);
    } else {
      setSelectedTpl(pending);
      setWidthMm(pending.widthMm);
      setHeightMm(pending.heightMm);
      setAspect(pending.widthMm / pending.heightMm);
    }
  }, []);

  useEffect(() => {
    const id = searchParams.get("sablon")?.trim();
    if (!id || sablonPrefilledRef.current) return;
    const tpl = DIE_CUT_BY_ID.get(id);
    if (!tpl) return;
    sablonPrefilledRef.current = true;
    setBladeTab("template");
    setCategory(tpl.category);
    setSelectedTpl(tpl);
    setWidthMm(tpl.widthMm);
    setHeightMm(tpl.heightMm);
    setAspect(tpl.widthMm / tpl.heightMm);
    pendingShapeRef.current = tpl;
  }, [searchParams]);

  const handleCanvasReady = useCallback(() => {
    canvasReadyRef.current = true;
    flushPendingShape();
    if (bladeTab === "auto" && !selectedTpl) {
      pendingShapeRef.current = "contour";
      flushPendingShape();
    }
  }, [bladeTab, flushPendingShape, selectedTpl]);

  const handleDesignLoaded = useCallback(
    ({ widthPx, heightPx }: { widthPx: number; heightPx: number }) => {
      if (!design?.tempId || selectedTpl) return;
      if (dimsAppliedRef.current === design.tempId) return;
      dimsAppliedRef.current = design.tempId;
      const suggested = suggestMmFromPixels(widthPx, heightPx);
      setAspect(suggested.aspect);
      setWidthMm(suggested.widthMm);
      setHeightMm(suggested.heightMm);
      canvasReadyRef.current = true;
    },
    [design?.tempId, selectedTpl]
  );

  const setAutoContour = useCallback(() => {
    setSelectedTpl(null);
    pendingShapeRef.current = "contour";
  }, []);

  const handleWidthChange = (w: number) => {
    setWidthMm(w);
    if (lockAspect && aspect > 0) {
      setHeightMm(Math.round(w / aspect));
    }
  };

  const handleHeightChange = (h: number) => {
    setHeightMm(h);
    if (lockAspect && aspect > 0) {
      setWidthMm(Math.round(h * aspect));
    }
  };

  const handleToggleLayer = (layer: EditorLayer, on: boolean) => {
    setLayers((prev) => ({ ...prev, [layer]: on }));
    canvasRef.current?.setLayerVisibility(layer, on);
  };

  const persistDraft = useCallback(
    async (payload: {
      svg: string;
      preview_png_base64: string | null;
      meta: Record<string, unknown>;
    }): Promise<string | null> => {
      if (!design) return null;
      setSaving(true);
      try {
        const res = await fetch("/api/editor/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tempDesignId: design.tempId,
            svg: payload.svg,
            preview_png_base64: payload.preview_png_base64 ?? undefined,
            source: payload.meta.source ?? "raster",
            mode: payload.meta.mode ?? "contour",
            offset_mm: payload.meta.offset_mm ?? offsetMm,
            width_mm: payload.meta.width_mm ?? widthMm,
            height_mm: payload.meta.height_mm ?? heightMm,
            cutline_width_mm: payload.meta.cutline_width_mm,
            cutline_height_mm: payload.meta.cutline_height_mm,
            material_type: payload.meta.material_type ?? "paper",
            placement_json: payload.meta.image_placement,
          }),
        });
        const data = (await res.json()) as { draftId?: string; error?: string };
        if (!res.ok || !data.draftId) {
          toast.error(data.error ?? "Kayıt başarısız");
          exportWaitRef.current?.(null);
          exportWaitRef.current = null;
          return null;
        }
        setDraftId(data.draftId);
        exportWaitRef.current?.(data.draftId);
        exportWaitRef.current = null;
        return data.draftId;
      } catch {
        toast.error("Kayıt sırasında bağlantı hatası");
        exportWaitRef.current?.(null);
        exportWaitRef.current = null;
        return null;
      } finally {
        setSaving(false);
      }
    },
    [design, widthMm, heightMm, offsetMm, toast]
  );

  const handleSaved = useCallback(
    (payload: {
      svg: string;
      preview_png_base64: string | null;
      meta: Record<string, unknown>;
    }) => {
      void persistDraft(payload);
    },
    [persistDraft]
  );

  const removeBackground = async () => {
    if (!design) return;
    setBgLoading(true);
    try {
      const res = await fetch("/api/editor/bg-remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tempDesignId: design.tempId }),
      });
      const data = (await res.json()) as {
        newTempDesignId?: string;
        previewUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.newTempDesignId) {
        toast.error(data.error ?? "Arka plan kaldırılamadı");
        return;
      }
      skipDimResetRef.current = true;
      setDesign({
        ...design,
        tempId: data.newTempDesignId,
        previewUrl: data.previewUrl ?? design.previewUrl,
        fileName: design.fileName.replace(/(\.[^.]+)?$/, "-nobg.png"),
        mimeType: "image/png",
      });
      setBgDetect(null);
      toast.success("Arka plan kaldırıldı");
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setBgLoading(false);
    }
  };

  const waitForCutlineReady = useCallback(async (maxMs = 20_000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const canvas = canvasRef.current;
      if (
        canvas?.isCutlineReady?.() &&
        !canvas.isContourRefining?.()
      ) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }, []);

  const ensureDraftSaved = useCallback((): Promise<string | null> => {
    if (draftId) return Promise.resolve(draftId);
    if (pendingSavePromiseRef.current) {
      return pendingSavePromiseRef.current;
    }

    const promise = (async () => {
      if (bladeShape.kind === "none") {
        return null;
      }
      const cutlineReady = await waitForCutlineReady();
      if (!cutlineReady) return null;

      return await new Promise<string | null>((resolve) => {
      exportWaitRef.current = (id) => {
        exportWaitRef.current = null;
        resolve(id);
      };
      canvasRef.current?.requestExport();
      window.setTimeout(() => {
        if (exportWaitRef.current) {
          exportWaitRef.current(null);
        }
      }, 12_000);
      });
    })().finally(() => {
      pendingSavePromiseRef.current = null;
    });

    pendingSavePromiseRef.current = promise;
    return promise;
  }, [bladeShape.kind, draftId, waitForCutlineReady]);

  const addToProduct = async (product: "sticker" | "etiket") => {
    if (!design) {
      toast.error("Önce görsel yükle");
      return;
    }
    if (bladeShape.kind === "none") {
      toast.error("Önce bıçak seçin (şablon veya otomatik kontur)");
      setLeftPanel("blade");
      return;
    }

    let resolvedDraftId = draftId;
    if (!resolvedDraftId) {
      toast.info("Bıçak kaydediliyor…");
      resolvedDraftId = await ensureDraftSaved();
    }
    if (!resolvedDraftId) {
      toast.error("Bıçak kaydı alınamadı — tekrar dene");
      return;
    }

    writeEditorHandoff({
      tempId: design.tempId,
      previewUrl: design.generatedPreviewUrl ?? design.previewUrl,
      fileName: design.fileName,
      mimeType: design.mimeType,
      sizeBytes: design.sizeBytes,
      editorCutlineDraftId: resolvedDraftId,
      widthMm,
      heightMm,
    });

    router.push(
      product === "etiket"
        ? "/etiket/yapilandir?from=editor"
        : "/sticker/yapilandir?from=editor"
    );
  };

  const handleFitContain = useCallback(() => {
    canvasRef.current?.fitContain();
  }, []);

  const bladeSearchNorm = bladeSearch.trim().toLocaleLowerCase("tr");

  const filteredTemplates = DIE_CUT_TEMPLATES.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (
      bladeSearchNorm &&
      !t.label.toLocaleLowerCase("tr").includes(bladeSearchNorm)
    ) {
      return false;
    }
    return true;
  });

  const openAutoBlade = () => {
    setLeftPanel("blade");
    setBladeTab("auto");
    setAutoContour();
  };

  const zoomIn = () =>
    setViewZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10));
  const zoomOut = () =>
    setViewZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10));

  return (
    <main
      className="editor-workspace min-h-[calc(100dvh-56px)] bg-gri-50"
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
      <div
        className="grid h-[calc(100dvh-56px)] w-full max-w-[1600px] mx-auto grid-cols-[52px_minmax(240px,300px)_1fr_minmax(248px,300px)] grid-rows-[auto_1fr]"
        style={{
          gridTemplateAreas: `
            "top top top top"
            "rail flyout canvas right"
          `,
        }}
      >
        <header
          className="sticky top-0 z-30 col-span-4 flex flex-wrap items-center gap-3 border-b border-gri-200 bg-white px-3 py-2.5 shadow-1"
          style={{ gridArea: "top" }}
        >
          <h1 className="shrink-0 text-[15px] md:text-[17px] font-semibold tracking-tight text-lacivert">
            Bıçak & baskı hazırlama
          </h1>

          <div className="flex flex-1 justify-center min-w-0">
            <EditorZoomControls
              zoom={viewZoom}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={() => setViewZoom(1)}
              onFitContain={handleFitContain}
            />
          </div>

          <div
            className="flex shrink-0 flex-wrap items-center gap-2 ml-auto"
            data-onboard="export"
          >
            {saving ? (
              <span className="text-[11px] text-gri-600">Kaydediliyor…</span>
            ) : null}
            {draftId ? (
              <Pill variant="yesil" className="hidden sm:inline-flex">
                Kayıtlı
              </Pill>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void addToProduct("sticker")}
            >
              Sticker&apos;a ekle
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => void addToProduct("etiket")}
            >
              Etiket&apos;e ekle
            </Button>
          </div>
        </header>

        <nav
          className="flex flex-col items-center gap-1 border-r border-gri-200 bg-white py-3"
          style={{ gridArea: "rail" }}
          aria-label="Sol menü"
        >
          <button
            type="button"
            title="Dosya"
            data-onboard="file"
            aria-current={leftPanel === "file" ? "true" : undefined}
            onClick={() => setLeftPanel("file")}
            className={cn(
              "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-colors",
              leftPanel === "file"
                ? "bg-pim-mercan-tint text-pim-mercan"
                : "text-gri-600 hover:bg-gri-100"
            )}
          >
            <span className="text-[18px] leading-none" aria-hidden>
              📁
            </span>
            Dosya
          </button>
          <button
            type="button"
            title="Bıçak"
            data-onboard="blade"
            aria-current={leftPanel === "blade" ? "true" : undefined}
            onClick={() => setLeftPanel("blade")}
            className={cn(
              "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-colors",
              leftPanel === "blade"
                ? "bg-pim-mercan-tint text-pim-mercan"
                : "text-gri-600 hover:bg-gri-100"
            )}
          >
            <span className="text-[18px] leading-none" aria-hidden>
              ✂
            </span>
            Bıçak
          </button>
        </nav>

        <aside
          className="overflow-y-auto border-r border-gri-200 bg-white p-4"
          style={{ gridArea: "flyout" }}
        >
          {leftPanel === "file" ? (
            <>
              <h2 className="text-[15px] font-semibold">Dosya</h2>
              <p className="mt-1 text-[12.5px] text-gri-700">
                Desteklenen formatlar: PNG, JPG, PDF, AI, PSD.
              </p>
              <div className="mt-4">
                <DesignDropZone value={design} onChange={setDesign} />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold">Bıçak</h2>
              <CutColorNote />
              <Button
                type="button"
                variant="primary"
                className="mt-3 w-full"
                onClick={openAutoBlade}
              >
                Otomatik bıçak oluştur
              </Button>
              <div className="mt-3 flex gap-1 rounded-lg bg-gri-100 p-1">
                <button
                  type="button"
                  className={cn(
                    "flex-1 h-8 rounded-md text-[12px] font-semibold",
                    bladeTab === "template" && "bg-white shadow-1"
                  )}
                  onClick={() => setBladeTab("template")}
                >
                  Hazır şablon
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 h-8 rounded-md text-[12px] font-semibold",
                    bladeTab === "auto" && "bg-white shadow-1"
                  )}
                  onClick={() => {
                    setBladeTab("auto");
                    setAutoContour();
                  }}
                >
                  Otomatik
                </button>
              </div>
              {bladeTab === "template" ? (
                <>
                  <Input
                    type="search"
                    placeholder="Şablon ara…"
                    value={bladeSearch}
                    onChange={(e) => setBladeSearch(e.target.value)}
                    className="mt-3"
                    aria-label="Bıçak şablonu ara"
                  />
                  <div className="mt-3 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={cn(
                        "h-7 px-2 rounded-full text-[11px] font-semibold",
                        category === "all"
                          ? "bg-pim-mercan-tint text-pim-mercan"
                          : "bg-gri-100"
                      )}
                      onClick={() => setCategory("all")}
                    >
                      Hepsi
                    </button>
                    {(Object.keys(CATEGORY_LABELS) as ShapeCategory[]).map(
                      (c) => (
                        <button
                          key={c}
                          type="button"
                          className={cn(
                            "h-7 px-2 rounded-full text-[11px] font-semibold",
                            category === c
                              ? "bg-pim-mercan-tint text-pim-mercan"
                              : "bg-gri-100"
                          )}
                          onClick={() => setCategory(c)}
                        >
                          {CATEGORY_LABELS[c]}
                        </button>
                      )
                    )}
                  </div>
                  <div className="mt-3 max-h-[min(420px,50vh)] overflow-y-auto grid grid-cols-2 gap-2">
                    {filteredTemplates.length === 0 ? (
                      <p className="col-span-2 py-4 text-center text-[12px] text-gri-600">
                        Eşleşen şablon yok.
                      </p>
                    ) : (
                      filteredTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className={cn(
                            "text-left rounded-lg ring-1 p-2 transition-colors",
                            selectedTpl?.id === tpl.id
                              ? "ring-pim-mercan bg-pim-mercan-tint"
                              : "ring-gri-200 hover:ring-pim-mercan"
                          )}
                        >
                          <ShapePreview tpl={tpl} set="kisscut" box={64} />
                          <div className="mt-1 text-[10.5px] font-semibold line-clamp-2">
                            {tpl.label}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    href="/sablonlar?tab=kesim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-center text-[12px] font-semibold text-pim-mercan hover:underline"
                  >
                    Tüm kesim şablonları →
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[13px] text-gri-700">
                    Kontur modu — görselin şeklinden otomatik bıçak üretilir.
                    Önce kaba çizgi gelir; birkaç saniye içinde kesim hattı
                    netleşir.
                  </p>
                  {contourRefining ? (
                    <p className="mt-2 text-[12px] font-medium text-pim-mercan">
                      Kesim hattı iyileştiriliyor…
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}
        </aside>

        <section
          className="editor-canvas-wrap relative flex min-h-0 flex-col overflow-hidden"
          style={{ gridArea: "canvas" }}
          onPointerDown={showCanvasHint ? dismissCanvasHint : undefined}
          onKeyDown={showCanvasHint ? dismissCanvasHint : undefined}
        >
          <div className="relative flex flex-1 min-h-0 flex-col m-3 rounded-xl ring-1 ring-gri-200 bg-transparent overflow-hidden shadow-1">
            {design && canvasMounted ? (
              <EditorCanvas
                ref={canvasRef}
                designUrl={designUrl}
                widthMm={widthMm}
                heightMm={heightMm}
                offsetMm={offsetMm}
                viewZoom={viewZoom}
                layers={layers}
                bladeShape={bladeShape}
                fixedHeight={CANVAS_HEIGHT}
                onSaved={handleSaved}
                onReady={handleCanvasReady}
                onDesignLoaded={handleDesignLoaded}
                onError={(m) => toast.error(m)}
                onContourRefining={setContourRefining}
              />
            ) : (
              <div className="flex flex-1 min-h-[480px] flex-col items-center justify-center gap-4 bg-gri-50 p-8 text-center">
                {!design ? (
                  <>
                    <p className="text-[15px] font-semibold text-gri-800">
                      Tasarımını burada önizle
                    </p>
                    <p className="max-w-[320px] text-[13px] text-gri-600">
                      Sol panelden görsel yükle; ardından bıçak ve boyut
                      ayarlarını yan panellerden yap.
                    </p>
                    <p className="text-[12px] text-gri-500">
                      Desteklenen formatlar: PNG, JPG, PDF, AI, PSD.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setLeftPanel("file")}
                    >
                      Görselini yükle
                    </Button>
                  </>
                ) : (
                  <p className="text-[14px] text-gri-600">Önizleme hazırlanıyor…</p>
                )}
              </div>
            )}
            <EditorCanvasHint
              visible={showCanvasHint && !!design && canvasMounted}
              onDismiss={dismissCanvasHint}
            />
          </div>
        </section>

        <aside
          className="overflow-y-auto border-l border-gri-200 bg-white p-4 space-y-5"
          style={{ gridArea: "right" }}
          aria-label="Özellikler"
          data-onboard="size"
        >
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gri-600">
              Boyut
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="editor-width-mm"
                  className="text-[11.5px] font-semibold"
                >
                  Genişlik (mm)
                </label>
                <Input
                  id="editor-width-mm"
                  type="number"
                  min={5}
                  max={500}
                  value={widthMm}
                  onChange={(e) =>
                    handleWidthChange(Number(e.target.value) || 50)
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="editor-height-mm"
                  className="text-[11.5px] font-semibold"
                >
                  Yükseklik (mm)
                </label>
                <Input
                  id="editor-height-mm"
                  type="number"
                  min={5}
                  max={500}
                  value={heightMm}
                  onChange={(e) =>
                    handleHeightChange(Number(e.target.value) || 50)
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
                className="accent-pim-mercan"
              />
              Oran kilidi
            </label>
            <Pill variant="gri" className="mt-2">
              {widthMm}×{heightMm} mm
            </Pill>
          </section>

          {bladeShape.kind === "none" ? (
            <p className="text-[12px] text-gri-600 leading-snug">
              Önce bıçak seç — hazır şablon veya otomatik kontur.
            </p>
          ) : null}

          <section>
            <label
              htmlFor="editor-offset-right"
              className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-wide text-gri-600"
            >
              <span>Kesim mesafesi</span>
              <span className="tabular-nums text-[12px] font-semibold text-gri-800 normal-case">
                {offsetMm.toFixed(1)} mm
              </span>
            </label>
            <input
              id="editor-offset-right"
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={offsetMm}
              onChange={(e) => setOffsetMm(parseFloat(e.target.value))}
              className="mt-2 w-full accent-pim-mercan"
            />
          </section>

          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gri-600">
              Arka plan
            </h2>
            {!design ? (
              <p className="mt-2 text-[12px] text-gri-500">
                Görsel yüklendikten sonra zemin analizi yapılır.
              </p>
            ) : bgDetect?.needsRemoval ? (
              <div className="mt-2 rounded-lg border border-sari/40 bg-sari-soft/50 p-3">
                <p className="text-[12px] text-lacivert">
                  Beyaz/düz zemin tespit edildi.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={bgLoading}
                  onClick={() => void removeBackground()}
                >
                  {bgLoading ? "Kaldırılıyor…" : "Arka planı kaldır"}
                </Button>
              </div>
            ) : bgDetect ? (
              <p className="mt-2 text-[12px] text-gri-600">
                Zemin uygun — ek işlem gerekmiyor.
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-gri-500">Zemin analizi…</p>
            )}
          </section>

          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gri-600 mb-2">
              Katmanlar
            </h2>
            <EditorLayerToggles
              layers={layers}
              onToggleLayer={handleToggleLayer}
            />
          </section>
        </aside>
      </div>
    </main>
  );
}
