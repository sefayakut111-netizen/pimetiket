"use client";

import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";
import { mmToPx } from "@/lib/editor/coords";
import {
  computeCutlineBundle,
  computeCutlineBundleFast,
  computeTemplateBundle,
} from "@/lib/editor/cutline/compute";
import { loadOpenCv } from "@/lib/editor/cutline/opencv-loader";
import type { CutlineBundle, CutlineMode } from "@/lib/editor/cutline/types";
import {
  buildCutlineSvgMm,
  buildEditorCutlineMeta,
} from "@/lib/editor/cutline/export-svg";
import { applyViewTransform } from "@/lib/editor/pikaso/apply-view-transform";
import type {
  BladeShapeConfig,
  PikasoEditorController,
} from "@/lib/editor/pikaso/controller-types";
import { placementFromPikasoImage } from "@/lib/editor/pikaso/placement";
import { renderLabelWorkspace } from "@/lib/editor/pikaso/render-label-workspace";
import {
  clearCutlineOverlays,
  renderCutlineOverlays,
} from "@/lib/editor/pikaso/render-cutline";
import { usePikasoEditor } from "@/lib/editor/pikaso/usePikasoEditor";
import {
  LABEL_ORIGIN_X,
  LABEL_ORIGIN_Y,
} from "@/lib/editor/pikaso/world-coords";
import type Pikaso from "pikaso";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export interface PikasoEditorCanvasProps {
  designUrl: string;
  widthMm: number;
  heightMm: number;
  offsetMm: number;
  viewZoom: number;
  layers: Record<EditorLayer, boolean>;
  bladeShape: BladeShapeConfig;
  /** İlk mount için yedek stage boyutu (ResizeObserver devralır) */
  fixedHeight?: number;
  onReady?: () => void;
  onDesignLoaded?: (dims: { widthPx: number; heightPx: number }) => void;
  onSaved: (payload: {
    svg: string;
    preview_png_base64: string | null;
    meta: Record<string, unknown>;
  }) => void;
  onError?: (msg: string) => void;
  /** OpenCV kontur iyileştirmesi sürüyor */
  onContourRefining?: (refining: boolean) => void;
}

type ImageShape = Awaited<ReturnType<Pikaso["shapes"]["image"]["insert"]>>;

const labelX = LABEL_ORIGIN_X;
const labelY = LABEL_ORIGIN_Y;

/** Hızlı önizleme — sürükleme/offset */
const FAST_PREVIEW_DEBOUNCE_MS = 350;
/** OpenCV — kullanıcı durunca arka planda (UI donmasın) */
const OPENCV_REFINE_DEBOUNCE_MS = 2200;

function needsOpenCvRefine(blade: BladeShapeConfig): boolean {
  return blade.kind === "contour" || blade.kind === "hull";
}

function resolveMode(blade: BladeShapeConfig): CutlineMode {
  if (blade.kind === "none") return "contour";
  if (blade.kind === "contour") return "contour";
  if (blade.kind === "hull") return "hull";
  if (blade.kind === "template") return blade.mode;
  return blade.kind;
}

export const PikasoEditorCanvas = forwardRef<
  PikasoEditorController,
  PikasoEditorCanvasProps
>(function PikasoEditorCanvas(
  {
    designUrl,
    widthMm,
    heightMm,
    offsetMm,
    viewZoom,
    layers,
    bladeShape,
    fixedHeight = 520,
    onReady,
    onDesignLoaded,
    onSaved,
    onError,
    onContourRefining,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { editorRef, ready } = usePikasoEditor(containerRef, {
    width: 800,
    height: fixedHeight,
  });
  const imageShapeRef = useRef<ImageShape | null>(null);
  const bundleRef = useRef<CutlineBundle | null>(null);
  const readyFiredRef = useRef(false);
  const htmlImageRef = useRef<HTMLImageElement | null>(null);
  const designObjectUrlRef = useRef<string | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const widthMmRef = useRef(widthMm);
  const heightMmRef = useRef(heightMm);
  const offsetMmRef = useRef(offsetMm);
  const viewZoomRef = useRef(viewZoom);
  const lastStageSizeRef = useRef({ w: 0, h: 0 });
  const resizeRafRef = useRef<number | null>(null);
  const recomputeGenRef = useRef(0);
  const recomputeRunningRef = useRef(false);
  const recomputeQueuedRef = useRef(false);
  const opencvRunningRef = useRef(false);
  const opencvQueuedRef = useRef(false);
  const fastDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opencvDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contourRefiningRef = useRef(false);
  const bladeShapeRef = useRef(bladeShape);
  bladeShapeRef.current = bladeShape;
  widthMmRef.current = widthMm;
  heightMmRef.current = heightMm;
  offsetMmRef.current = offsetMm;
  viewZoomRef.current = viewZoom;

  const syncLabelWorkspace = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !ready) return;
    renderLabelWorkspace(editor, {
      labelX,
      labelY,
      widthMm: widthMmRef.current,
      heightMm: heightMmRef.current,
    });
  }, [editorRef, ready]);

  const syncViewTransform = useCallback(() => {
    const editor = editorRef.current;
    const el = containerRef.current;
    if (!editor || !el) return;
    const stage = editor.board.stage;
    const stageW = stage.width();
    const stageH = stage.height();
    if (stageW < 1 || stageH < 1) return;
    applyViewTransform(editor, {
      stageWidth: stageW,
      stageHeight: stageH,
      widthMm: widthMmRef.current,
      heightMm: heightMmRef.current,
      viewZoom: viewZoomRef.current,
      labelX,
      labelY,
    });
  }, [editorRef]);

  const applyStageSize = useCallback(() => {
    const el = containerRef.current;
    const editor = editorRef.current;
    if (!el || !editor) return;
    const w = Math.max(1, Math.round(el.clientWidth));
    const h = Math.max(1, Math.round(el.clientHeight));
    const last = lastStageSizeRef.current;
    const stage = editor.board.stage;
    const stageW = Math.round(stage.width());
    const stageH = Math.round(stage.height());
    if (last.w === w && last.h === h && stageW === w && stageH === h) {
      return;
    }
    lastStageSizeRef.current = { w, h };
    if (stageW !== w || stageH !== h) {
      stage.size({ width: w, height: h });
    }
    syncViewTransform();
  }, [editorRef, syncViewTransform]);

  const setContourRefining = useCallback(
    (on: boolean) => {
      if (contourRefiningRef.current === on) return;
      contourRefiningRef.current = on;
      onContourRefining?.(on);
    },
    [onContourRefining]
  );

  const renderBundle = useCallback(
    (editor: Pikaso, bundle: CutlineBundle) => {
      bundleRef.current = bundle;
      renderCutlineOverlays(editor, bundle, {
        labelX,
        labelY,
        layers: {
          cut: layersRef.current.cut,
          bleed: layersRef.current.bleed,
          safe: layersRef.current.safe,
        },
      });
    },
    []
  );

  const buildContourInput = useCallback(
    (
      blade: BladeShapeConfig,
      shape: ImageShape,
      img: HTMLImageElement,
      wMm: number,
      hMm: number,
      offMm: number
    ) => {
      const { placementMm } = placementFromPikasoImage(shape);
      return {
        mode: resolveMode(blade),
        labelWidthMm: wMm,
        labelHeightMm: hMm,
        offsetMm: offMm,
        cornerRadiusMm:
          blade.kind === "rect" ? (blade.cornerRadiusMm ?? 0) : 0,
        image: img,
        imagePlacementMm: placementMm,
      };
    },
    []
  );

  const applyFastCutlinePreview = useCallback(() => {
    const blade = bladeShapeRef.current;
    const editor = editorRef.current;
    const img = htmlImageRef.current;
    const shape = imageShapeRef.current;
    const wMm = widthMmRef.current;
    const hMm = heightMmRef.current;
    const offMm = offsetMmRef.current;
    if (!editor || !img || !shape) return;

    if (blade.kind === "none") {
      clearCutlineOverlays(editor);
      bundleRef.current = null;
      return;
    }

    if (!needsOpenCvRefine(blade)) return;

    const preview = computeCutlineBundleFast(
      buildContourInput(blade, shape, img, wMm, hMm, offMm)
    );
    if (preview) renderBundle(editor, preview);
  }, [buildContourInput, editorRef, renderBundle]);

  const recomputeStaticCutline = useCallback(async () => {
    if (recomputeRunningRef.current) {
      recomputeQueuedRef.current = true;
      return;
    }
    recomputeRunningRef.current = true;
    const gen = ++recomputeGenRef.current;
    try {
      const blade = bladeShapeRef.current;
      const editor = editorRef.current;
      const img = htmlImageRef.current;
      const shape = imageShapeRef.current;
      const wMm = widthMmRef.current;
      const hMm = heightMmRef.current;
      const offMm = offsetMmRef.current;
      if (!editor || !img || !shape) return;

      if (blade.kind === "none") {
        clearCutlineOverlays(editor);
        bundleRef.current = null;
        return;
      }

      let bundle: CutlineBundle;
      if (blade.kind === "template") {
        const t = blade.template;
        bundle = computeTemplateBundle({
          shape: t.shape,
          widthMm: t.widthMm,
          heightMm: t.heightMm,
          offsetMm: offMm,
        });
      } else {
        bundle = await computeCutlineBundle(
          buildContourInput(blade, shape, img, wMm, hMm, offMm)
        );
      }

      if (gen !== recomputeGenRef.current) return;
      renderBundle(editor, bundle);
    } finally {
      recomputeRunningRef.current = false;
      if (recomputeQueuedRef.current) {
        recomputeQueuedRef.current = false;
        void recomputeStaticCutline();
      }
    }
  }, [buildContourInput, editorRef, renderBundle]);

  const runOpenCvRefine = useCallback(async () => {
    if (!needsOpenCvRefine(bladeShapeRef.current)) return;
    if (opencvRunningRef.current) {
      opencvQueuedRef.current = true;
      return;
    }
    opencvRunningRef.current = true;
    const gen = ++recomputeGenRef.current;
    try {
      const blade = bladeShapeRef.current;
      const editor = editorRef.current;
      const img = htmlImageRef.current;
      const shape = imageShapeRef.current;
      const wMm = widthMmRef.current;
      const hMm = heightMmRef.current;
      const offMm = offsetMmRef.current;
      if (!editor || !img || !shape) return;

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (gen !== recomputeGenRef.current) return;

      setContourRefining(true);
      const bundle = await computeCutlineBundle(
        buildContourInput(blade, shape, img, wMm, hMm, offMm)
      );
      if (gen !== recomputeGenRef.current) return;
      renderBundle(editor, bundle);
    } finally {
      setContourRefining(false);
      opencvRunningRef.current = false;
      if (opencvQueuedRef.current) {
        opencvQueuedRef.current = false;
        void runOpenCvRefine();
      }
    }
  }, [buildContourInput, editorRef, renderBundle, setContourRefining]);

  const cancelScheduledCutline = useCallback(() => {
    if (fastDebounceRef.current) {
      clearTimeout(fastDebounceRef.current);
      fastDebounceRef.current = null;
    }
    if (opencvDebounceRef.current) {
      clearTimeout(opencvDebounceRef.current);
      opencvDebounceRef.current = null;
    }
  }, []);

  const scheduleOpenCvRefine = useCallback(() => {
    if (!needsOpenCvRefine(bladeShapeRef.current)) return;
    if (opencvDebounceRef.current) {
      clearTimeout(opencvDebounceRef.current);
    }
    opencvDebounceRef.current = setTimeout(() => {
      opencvDebounceRef.current = null;
      void runOpenCvRefine();
    }, OPENCV_REFINE_DEBOUNCE_MS);
  }, [runOpenCvRefine]);

  const scheduleRecomputeCutline = useCallback(
    (opts?: { fastImmediate?: boolean }) => {
      cancelScheduledCutline();
      recomputeGenRef.current += 1;

      const blade = bladeShapeRef.current;
      if (blade.kind === "none") {
        applyFastCutlinePreview();
        return;
      }
      if (blade.kind === "template") {
        void recomputeStaticCutline();
        return;
      }
      if (!needsOpenCvRefine(blade)) {
        void recomputeStaticCutline();
        return;
      }

      const runFast = () => applyFastCutlinePreview();
      if (opts?.fastImmediate) {
        runFast();
      } else {
        fastDebounceRef.current = setTimeout(() => {
          fastDebounceRef.current = null;
          runFast();
        }, FAST_PREVIEW_DEBOUNCE_MS);
      }
      scheduleOpenCvRefine();
    },
    [
      applyFastCutlinePreview,
      cancelScheduledCutline,
      recomputeStaticCutline,
      scheduleOpenCvRefine,
    ]
  );

  const flushOpenCvRefine = useCallback(async () => {
    if (!needsOpenCvRefine(bladeShapeRef.current)) return;
    cancelScheduledCutline();
    await runOpenCvRefine();
  }, [cancelScheduledCutline, runOpenCvRefine]);

  const fitImageContain = useCallback(() => {
    const shape = imageShapeRef.current;
    const img = htmlImageRef.current;
    if (!shape || !img) return;
    const marginMm = 2;
    const maxWmm = widthMm - marginMm * 2;
    const maxHmm = heightMm - marginMm * 2;
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawWMm = maxWmm;
    let drawHMm = drawWMm / aspect;
    if (drawHMm > maxHmm) {
      drawHMm = maxHmm;
      drawWMm = drawHMm * aspect;
    }
    const drawW = mmToPx(drawWMm);
    shape.update({
      x: labelX + mmToPx((widthMm - drawWMm) / 2),
      y: labelY + mmToPx((heightMm - drawHMm) / 2),
      width: img.naturalWidth,
      height: img.naturalHeight,
      scaleX: drawW / img.naturalWidth,
      scaleY: drawW / img.naturalWidth,
      rotation: 0,
    });
    imageShapeRef.current?.select();
    scheduleRecomputeCutline({ fastImmediate: true });
  }, [heightMm, scheduleRecomputeCutline, widthMm]);

  const loadDesign = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !ready) return;
    try {
      const res = await fetch(designUrl, { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const file = new File([blob], "design", {
        type: blob.type || "image/png",
      });
      let natW: number;
      let natH: number;
      try {
        const bmp = await createImageBitmap(blob);
        natW = bmp.width;
        natH = bmp.height;
        bmp.close();
      } catch (bitmapErr) {
        const probeUrl = URL.createObjectURL(blob);
        try {
          const probe = new window.Image();
          await new Promise<void>((resolve, reject) => {
            probe.onload = () => resolve();
            probe.onerror = () =>
              reject(
                bitmapErr instanceof Error
                  ? bitmapErr
                  : new Error("image decode")
              );
            probe.src = probeUrl;
          });
          natW = probe.naturalWidth;
          natH = probe.naturalHeight;
        } finally {
          URL.revokeObjectURL(probeUrl);
        }
      }

      editor.reset();
      imageShapeRef.current = null;
      bundleRef.current = null;
      renderLabelWorkspace(editor, {
        labelX,
        labelY,
        widthMm,
        heightMm,
      });

      if (designObjectUrlRef.current) {
        URL.revokeObjectURL(designObjectUrlRef.current);
        designObjectUrlRef.current = null;
      }
      const objectUrl = URL.createObjectURL(blob);
      designObjectUrlRef.current = objectUrl;
      const htmlImg = new window.Image();
      htmlImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        htmlImg.onload = () => resolve();
        htmlImg.onerror = () => reject(new Error("image decode"));
        htmlImg.src = objectUrl;
      });
      htmlImageRef.current = htmlImg;

      const marginMm = 2;
      const maxWmm = widthMm - marginMm * 2;
      const maxHmm = heightMm - marginMm * 2;
      const aspect = natW / natH;
      let drawWMm = maxWmm;
      let drawHMm = drawWMm / aspect;
      if (drawHMm > maxHmm) {
        drawHMm = maxHmm;
        drawWMm = drawHMm * aspect;
      }
      const drawW = mmToPx(drawWMm);

      const shape = await editor.shapes.image.insert(file, {
        x: labelX + mmToPx((widthMm - drawWMm) / 2),
        y: labelY + mmToPx((heightMm - drawHMm) / 2),
        width: natW,
        height: natH,
        scaleX: drawW / natW,
        scaleY: drawW / natW,
        draggable: true,
        name: "pim-user-image",
      });
      imageShapeRef.current = shape;
      shape.select();
      syncLabelWorkspace();

      onDesignLoaded?.({ widthPx: natW, heightPx: natH });
      scheduleRecomputeCutline({ fastImmediate: true });
      syncViewTransform();

      if (!readyFiredRef.current) {
        readyFiredRef.current = true;
        onReady?.();
      }
    } catch {
      onError?.("Görsel yüklenemedi");
    }
  }, [
    designUrl,
    editorRef,
    heightMm,
    onDesignLoaded,
    onError,
    onReady,
    ready,
    scheduleRecomputeCutline,
    syncLabelWorkspace,
    syncViewTransform,
    widthMm,
  ]);

  const exportCutline = useCallback(async () => {
    if (needsOpenCvRefine(bladeShapeRef.current)) {
      await flushOpenCvRefine();
    }
    const editor = editorRef.current;
    const shape = imageShapeRef.current;
    const bundle = bundleRef.current;
    if (!editor || !shape || !bundle) {
      onError?.("Bıçak henüz hazır değil");
      return;
    }
    const { placementMm, scale } = placementFromPikasoImage(shape);
    const svg = buildCutlineSvgMm({
      bundle,
      labelWidthMm: widthMm,
      labelHeightMm: heightMm,
    });
    let preview: string | null = null;
    try {
      const dataUrl = editor.board.stage.toDataURL({ pixelRatio: 1 });
      if (dataUrl.startsWith("data:image/png;base64,")) {
        preview = dataUrl.slice("data:image/png;base64,".length);
      }
    } catch {
      preview = null;
    }
    onSaved({
      svg,
      preview_png_base64: preview,
      meta: buildEditorCutlineMeta({
        mode: resolveMode(bladeShape),
        offsetMm,
        widthMm,
        heightMm,
        bundle,
        imagePlacement: {
          x: placementMm.x,
          y: placementMm.y,
          scale,
        },
      }),
    });
  }, [
    bladeShape,
    editorRef,
    heightMm,
    offsetMm,
    onError,
    onSaved,
    widthMm,
    flushOpenCvRefine,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      fitContain: () => fitImageContain(),
      requestExport: () => {
        void exportCutline();
      },
      setLayerVisibility: () => {
        /* Katman görünürlüğü layers prop effect ile — OpenCV yok */
      },
      isReady: () => ready && !!imageShapeRef.current,
      isCutlineReady: () => {
        const blade = bladeShapeRef.current;
        if (blade.kind === "none") return false;
        return bundleRef.current != null;
      },
      isContourRefining: () => contourRefiningRef.current,
    }),
    [exportCutline, fitImageContain, ready]
  );

  const loadDesignRef = useRef(loadDesign);
  loadDesignRef.current = loadDesign;

  useEffect(() => {
    if (!designUrl) {
      loadedUrlRef.current = null;
    }
  }, [designUrl]);

  useEffect(() => {
    if (!ready || !htmlImageRef.current) return;
    const preload = () => {
      void loadOpenCv();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(preload, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(preload, 800);
    return () => window.clearTimeout(t);
  }, [ready, designUrl]);

  useEffect(() => {
    if (!ready) return;
    if (loadedUrlRef.current === designUrl) return;
    loadedUrlRef.current = designUrl;
    void loadDesignRef.current();
  }, [designUrl, ready]);

  useEffect(() => {
    syncLabelWorkspace();
  }, [widthMm, heightMm, ready, syncLabelWorkspace]);

  useEffect(() => {
    syncViewTransform();
  }, [viewZoom, widthMm, heightMm, ready, syncViewTransform]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !editorRef.current || !ready) return;

    const ro = new ResizeObserver(() => {
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        applyStageSize();
      });
    });
    ro.observe(el);
    applyStageSize();

    return () => {
      ro.disconnect();
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [ready, editorRef, applyStageSize]);

  useEffect(() => {
    scheduleRecomputeCutline({
      fastImmediate:
        bladeShape.kind === "contour" || bladeShape.kind === "hull",
    });
  }, [widthMm, heightMm, offsetMm, bladeShape, scheduleRecomputeCutline]);

  useEffect(() => {
    const editor = editorRef.current;
    const bundle = bundleRef.current;
    if (!editor || !ready || !bundle) return;
    renderCutlineOverlays(editor, bundle, {
      labelX,
      labelY,
      layers: {
        cut: layers.cut,
        bleed: layers.bleed,
        safe: layers.safe,
      },
    });
  }, [layers.cut, layers.bleed, layers.safe, ready, editorRef]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready) return;
    const onTransformEnd = () => scheduleRecomputeCutline();
    editor.on(["selection:dragend", "selection:transformend"], onTransformEnd);
    return () => {
      editor.off(["selection:dragend", "selection:transformend"], onTransformEnd);
    };
  }, [ready, editorRef, scheduleRecomputeCutline]);

  useEffect(() => {
    return () => {
      cancelScheduledCutline();
      recomputeGenRef.current += 1;
      if (designObjectUrlRef.current) {
        URL.revokeObjectURL(designObjectUrlRef.current);
        designObjectUrlRef.current = null;
      }
    };
  }, [cancelScheduledCutline]);

  return (
    <div
      ref={containerRef}
      className="editor-stage-host h-full w-full min-h-0 overflow-hidden"
    />
  );
});
