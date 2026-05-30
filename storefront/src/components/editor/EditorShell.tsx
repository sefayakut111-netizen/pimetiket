"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  EditorPreviewToolbar,
  type EditorLayer,
} from "@/components/editor/EditorPreviewToolbar";
import { CutColorNote } from "@/components/editor/CutColorNote";
import { ShapePreview } from "@/components/templates/ShapePreview";
import { Button, Card, Eyebrow, Input, Pill, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildEditorIframeSrc } from "@/lib/editor/build-editor-iframe-src";
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

const STEPS = ["Dosya", "Bıçak", "Boyut", "Ürüne ekle"] as const;

const CANVAS_HEIGHT = 520;

type BladeTab = "template" | "auto";

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

  const [step, setStep] = useState(1);
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
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const dimsAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    dimsAppliedRef.current = null;
  }, [design?.tempId]);
  useEffect(() => {
    if (!design) {
      setIframeSrc(null);
      setCanvasMounted(false);
      canvasReadyRef.current = false;
      return;
    }
    setIframeSrc(
      buildEditorIframeSrc({
        tempDesignId: design.tempId,
        fileName: design.fileName,
        mimeType: design.mimeType,
        widthMm,
        heightMm,
        origin: window.location.origin,
      })
    );
    setCanvasMounted(true);
    canvasReadyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mm ilk URL'de; sonrası postMessage
  }, [design?.tempId, design?.fileName, design?.mimeType]);

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

  const syncSizeToCanvas = useCallback((w: number, h: number) => {
    canvasRef.current?.postMessage({
      type: "pim-editor-set-size",
      widthMm: w,
      heightMm: h,
    });
  }, []);

  const syncOffsetToCanvas = useCallback((mm: number) => {
    canvasRef.current?.postMessage({ type: "pim-set-offset", offsetMm: mm });
  }, []);

  const syncZoomToCanvas = useCallback((zoom: number) => {
    canvasRef.current?.postMessage({ type: "pim-set-view-zoom", zoom });
  }, []);

  const applyTemplate = useCallback((tpl: DieCutTemplate) => {
    setSelectedTpl(tpl);
    setWidthMm(tpl.widthMm);
    setHeightMm(tpl.heightMm);
    setAspect(tpl.widthMm / tpl.heightMm);
    pendingShapeRef.current = tpl;
    if (!canvasReadyRef.current) return;
    const mode =
      tpl.shape === "circle"
        ? "circle"
        : tpl.shape === "rect" || tpl.shape === "ellipse"
          ? "rect"
          : "contour";
    canvasRef.current?.postMessage({
      type: "pim-editor-set-shape",
      shape: tpl.shape,
      widthMm: tpl.widthMm,
      heightMm: tpl.heightMm,
      cornerRadiusMm: tpl.cornerRadiusMm,
      mode,
    });
  }, []);

  const flushPendingShape = useCallback(() => {
    if (!canvasReadyRef.current || !pendingShapeRef.current) return;
    const pending = pendingShapeRef.current;
    pendingShapeRef.current = null;
    if (pending === "contour") {
      canvasRef.current?.postMessage({
        type: "pim-editor-set-shape",
        shape: "contour",
        mode: "contour",
        widthMm,
        heightMm,
      });
    } else {
      applyTemplate(pending);
    }
  }, [applyTemplate, widthMm, heightMm]);

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
    syncSizeToCanvas(widthMm, heightMm);
    syncOffsetToCanvas(offsetMm);
    syncZoomToCanvas(viewZoom);
    for (const [layer, on] of Object.entries(layers) as [EditorLayer, boolean][]) {
      canvasRef.current?.postMessage({ type: "pim-toggle-layer", layer, on });
    }
    flushPendingShape();
    if (step >= 2 && bladeTab === "auto" && !selectedTpl) {
      pendingShapeRef.current = "contour";
      flushPendingShape();
    }
  }, [
    bladeTab,
    flushPendingShape,
    layers,
    offsetMm,
    selectedTpl,
    step,
    syncOffsetToCanvas,
    syncSizeToCanvas,
    syncZoomToCanvas,
    viewZoom,
    widthMm,
    heightMm,
  ]);

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
      syncSizeToCanvas(suggested.widthMm, suggested.heightMm);
    },
    [design?.tempId, selectedTpl, syncSizeToCanvas]
  );

  const setAutoContour = useCallback(() => {
    setSelectedTpl(null);
    pendingShapeRef.current = "contour";
    if (canvasReadyRef.current) {
      canvasRef.current?.postMessage({
        type: "pim-editor-set-shape",
        shape: "contour",
        mode: "contour",
        widthMm,
        heightMm,
      });
    }
  }, [widthMm, heightMm]);

  useEffect(() => {
    if (!design || !canvasReadyRef.current) return;
    syncSizeToCanvas(widthMm, heightMm);
  }, [widthMm, heightMm, design, syncSizeToCanvas]);

  useEffect(() => {
    if (!canvasReadyRef.current) return;
    syncOffsetToCanvas(offsetMm);
  }, [offsetMm, syncOffsetToCanvas]);

  useEffect(() => {
    if (!canvasReadyRef.current) return;
    syncZoomToCanvas(viewZoom);
  }, [viewZoom, syncZoomToCanvas]);

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
    canvasRef.current?.postMessage({ type: "pim-toggle-layer", layer, on });
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

  const waitForExportSave = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      exportWaitRef.current = resolve;
      canvasRef.current?.postMessage({ type: "pim-request-export" });
      window.setTimeout(() => {
        if (exportWaitRef.current) {
          exportWaitRef.current(null);
          exportWaitRef.current = null;
        }
      }, 12_000);
    });
  }, []);

  /** Adım 4'e geçince bıçağı arka planda kaydet */
  useEffect(() => {
    if (step !== 4 || draftId || !design || !canvasReadyRef.current) return;
    canvasRef.current?.postMessage({ type: "pim-request-export" });
  }, [step, draftId, design]);

  const addToProduct = async (product: "sticker" | "etiket") => {
    if (!design) {
      toast.error("Önce görsel yükle");
      return;
    }

    let resolvedDraftId = draftId;
    if (!resolvedDraftId) {
      toast.info("Bıçak kaydediliyor…");
      resolvedDraftId = await waitForExportSave();
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

  const goNext = () => {
    if (step === 1 && !design) {
      toast.error("Önce bir görsel yükle");
      return;
    }
    if (step < STEPS.length) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const filteredTemplates = DIE_CUT_TEMPLATES.filter(
    (t) => category === "all" || t.category === category
  );

  return (
    <main className="py-6 pb-28 editor-workspace" data-editor-workspace>
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <Eyebrow>Üye editörü · Sıfırdan hazırla</Eyebrow>
        <h1 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight">
          Bıçak & baskı hazırlama
        </h1>
        <p className="mt-2 text-[14px] text-gri-700 max-w-[600px]">
          Görselini yükle, bıçağı belirle, boyutlandır — çıktı doğrudan ürün
          konfigüratörüne aktarılır. İndirme yok; bu ekran sipariş onayı (
          <span className="text-gri-600">/onay</span>) değildir.
        </p>

        <nav
          className="mt-6 flex gap-1 overflow-x-auto pb-1"
          aria-label="Editör adımları"
        >
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            const reachable = n <= step;
            return (
              <button
                key={label}
                type="button"
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                aria-disabled={!reachable}
                onClick={() => reachable && setStep(n)}
                className={cn(
                  "shrink-0 h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                  active && "bg-pim-mercan text-white",
                  !active && done && "bg-yesil-soft text-yesil",
                  !active && !done && reachable && "bg-gri-100 text-gri-600",
                  !reachable &&
                    "bg-gri-50 text-gri-400 cursor-not-allowed opacity-70"
                )}
              >
                {n}. {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_1fr] gap-5 items-start">
          <Card padding="p-5" className="h-fit lg:sticky lg:top-4">
            {step === 1 && (
              <>
                <h2 className="text-[16px] font-semibold">Dosya yükle</h2>
                <p className="mt-1 text-[13px] text-gri-700">
                  PNG, JPG, PDF, AI veya PSD. Yükleme sonrası önizleme sağda
                  açılır.
                </p>
                <div className="mt-4">
                  <DesignDropZone value={design} onChange={setDesign} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[16px] font-semibold">Bıçak seç</h2>
                <CutColorNote />
                <div className="mt-3 flex gap-1 p-1 rounded-lg bg-gri-100">
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
                    Görselden otomatik
                  </button>
                </div>
                {bladeTab === "template" ? (
                  <>
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
                    <div className="mt-3 max-h-[280px] overflow-y-auto grid grid-cols-2 gap-2">
                      {filteredTemplates.map((tpl) => (
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
                      ))}
                    </div>
                    <Link
                      href="/sablonlar?tab=kesim"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-center text-[12px] font-semibold text-pim-mercan hover:underline"
                    >
                      Tüm kesim şablonlarını gör →
                    </Link>
                  </>
                ) : (
                  <p className="mt-3 text-[13px] text-gri-700">
                    Kontur modu — görselin şeklinden otomatik bıçak üretilir.
                  </p>
                )}

                <div className="mt-4">
                  <label
                    htmlFor="editor-offset"
                    className="flex items-center justify-between text-[12px] font-semibold"
                  >
                    <span>Kesim mesafesi</span>
                    <span className="tabular-nums text-gri-600">
                      {offsetMm.toFixed(1)} mm
                    </span>
                  </label>
                  <input
                    id="editor-offset"
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={offsetMm}
                    onChange={(e) => setOffsetMm(parseFloat(e.target.value))}
                    className="mt-2 w-full accent-pim-mercan"
                  />
                  <p className="mt-1 text-[11px] text-gri-600">
                    Bıçak ile görsel arasındaki boşluk — önizlemede anında
                    güncellenir.
                  </p>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-[16px] font-semibold">Boyutlandır</h2>
                <p className="mt-1 text-[13px] text-gri-700">
                  Gerçek baskı boyutu (mm). Oran kilidi görselin en-boy oranını
                  korur.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-semibold">
                      Genişlik
                    </label>
                    <Input
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
                    <label className="text-[12px] font-semibold">
                      Yükseklik
                    </label>
                    <Input
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
                <label className="mt-3 flex items-center gap-2 text-[12.5px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="accent-pim-mercan"
                  />
                  Oran kilidi
                </label>
                <Pill variant="gri" className="mt-3">
                  {widthMm}×{heightMm} mm
                </Pill>

                {bgDetect?.needsRemoval ? (
                  <div className="mt-4 rounded-lg border border-sari/40 bg-sari-soft/50 p-3">
                    <p className="text-[12.5px] text-lacivert">
                      Beyaz/düz zemin tespit edildi — kaldırmak baskı kalitesini
                      artırır.
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
                  <p className="mt-4 text-[12px] text-gri-600">
                    Zemin uygun — ek arka plan işlemi gerekmiyor.
                  </p>
                ) : (
                  <p className="mt-4 text-[12px] text-gri-500">
                    Zemin analizi…
                  </p>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="text-[16px] font-semibold">Ürüne ekle</h2>
                <p className="mt-1 text-[13px] text-gri-700">
                  Sticker veya etiket konfigüratörüne geç — ölçü ve tasarım
                  ön-dolu gelir.
                </p>
                {draftId && (
                  <Pill variant="yesil" className="mt-2">
                    Bıçak kaydedildi
                  </Pill>
                )}
                {saving && (
                  <p className="mt-2 text-[12px] text-gri-600">Kaydediliyor…</p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={saving}
                    onClick={() => void addToProduct("sticker")}
                  >
                    Sticker&apos;a ekle
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void addToProduct("etiket")}
                  >
                    Etiket&apos;e ekle
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() =>
                    canvasRef.current?.postMessage({ type: "pim-request-export" })
                  }
                >
                  Bıçağı yeniden kaydet
                </Button>
              </>
            )}

            {step < 4 && (
              <div className="mt-5 flex gap-2 border-t border-gri-100 pt-4">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={goBack}
                  >
                    Geri
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  disabled={step === 1 && !design}
                  onClick={goNext}
                >
                  Devam
                </Button>
              </div>
            )}
          </Card>

          <div className="min-h-[480px] flex flex-col rounded-xl ring-1 ring-gri-200 bg-white overflow-hidden shadow-1">
            {design && canvasMounted ? (
              <>
                <EditorPreviewToolbar
                  zoom={viewZoom}
                  layers={layers}
                  widthMm={widthMm}
                  heightMm={heightMm}
                  onZoomIn={() =>
                    setViewZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))
                  }
                  onZoomOut={() =>
                    setViewZoom((z) =>
                      Math.max(0.25, Math.round((z - 0.1) * 10) / 10)
                    )
                  }
                  onZoomReset={() => setViewZoom(1)}
                  onToggleLayer={handleToggleLayer}
                />
                <EditorCanvas
                  ref={canvasRef}
                  iframeSrc={iframeSrc}
                  fixedHeight={CANVAS_HEIGHT}
                  onSaved={handleSaved}
                  onReady={handleCanvasReady}
                  onDesignLoaded={handleDesignLoaded}
                  onError={(m) => toast.error(m)}
                />
              </>
            ) : (
              <div className="flex flex-1 min-h-[480px] items-center justify-center bg-gri-50 text-gri-600 text-[14px] p-8 text-center">
                {step === 1 && !design
                  ? "Dosya yükleyince bıçak önizlemesi burada açılır."
                  : "Önizleme hazırlanıyor…"}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
