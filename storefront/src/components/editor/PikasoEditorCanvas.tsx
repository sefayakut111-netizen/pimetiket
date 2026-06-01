"use client";

import { getOpaqueBoundsPx } from "@/lib/editor/alpha-contour";
import { EDITOR_PX_PER_MM, mmToPx } from "@/lib/editor/coords";
import {
  computeCutlineBundle,
  computeCutlineBundleFast,
  computeTemplateBundle,
} from "@/lib/editor/cutline/compute";
import {
  preloadContourWorker,
  terminateContourWorker,
} from "@/lib/editor/cutline/contour-worker-client";
import type { CutlineBundle, CutlineMode } from "@/lib/editor/cutline/types";
import { ringCenterMm } from "@/lib/editor/cutline/shapes";
import {
  buildCutlineSvgMm,
  buildEditorCutlineMeta,
} from "@/lib/editor/cutline/export-svg";
import { applyViewTransform } from "@/lib/editor/pikaso/apply-view-transform";
import {
  applyBladeTransformToBundle,
  bladeTransformFromGroup,
  type BladeTransformMm,
} from "@/lib/editor/pikaso/blade-transform";
import { CUTLINE_GROUP_NAME, USER_IMAGE_NAME } from "@/lib/editor/pikaso/board-shapes";
import type {
  BladeShapeConfig,
  EditorEditTarget,
  PikasoEditorController,
} from "@/lib/editor/pikaso/controller-types";
import { placementFromPikasoImage } from "@/lib/editor/pikaso/placement";
import {
  imageAttrsForPreset,
  labelPlacementFrame,
  type PlacementPreset,
} from "@/lib/editor/pikaso/placement-presets";
import { renderLabelWorkspace } from "@/lib/editor/pikaso/render-label-workspace";
import { syncEditorZOrder } from "@/lib/editor/pikaso/board-shapes";
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
import Konva from "konva";
import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";
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
  smoothness: number;
  viewZoom: number;
  layers: Record<EditorLayer, boolean>;
  bladeShape: BladeShapeConfig;
  bladeTransform: BladeTransformMm;
  editTarget: EditorEditTarget;
  onBladeTransformChange?: (t: BladeTransformMm) => void;
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
const OPENCV_REFINE_DEBOUNCE_MS = 1400;

function needsOpenCvRefine(blade: BladeShapeConfig): boolean {
  return blade.kind === "contour" || blade.kind === "hull";
}

function isStaticBlade(blade: BladeShapeConfig): boolean {
  return (
    blade.kind === "template" ||
    blade.kind === "rect" ||
    blade.kind === "circle"
  );
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
    smoothness,
    viewZoom,
    layers,
    bladeShape,
    bladeTransform,
    editTarget,
    onBladeTransformChange,
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
  const smoothnessRef = useRef(smoothness);
  const viewZoomRef = useRef(viewZoom);
  const bladeTransformRef = useRef(bladeTransform);
  const editTargetRef = useRef(editTarget);
  const bladeTransformerRef = useRef<Konva.Transformer | null>(null);
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
  smoothnessRef.current = smoothness;
  viewZoomRef.current = viewZoom;
  bladeTransformRef.current = bladeTransform;
  editTargetRef.current = editTarget;

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

  const syncBladeTransformer = useCallback(
    (editor: Pikaso) => {
      const layer = editor.board.layer;
      const existing = bladeTransformerRef.current;
      if (existing) {
        existing.destroy();
        bladeTransformerRef.current = null;
      }
      if (editTargetRef.current !== "blade" || !bundleRef.current) return;

      const group = layer.findOne(`.${CUTLINE_GROUP_NAME}`);
      if (!group) return;

      const tr = new Konva.Transformer({
        nodes: [group],
        rotateEnabled: true,
        enabledAnchors: [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ],
        boundBoxFunc: (_old, next) => {
          if (next.width < 8 || next.height < 8) return _old;
          return next;
        },
      });
      layer.add(tr);
      bladeTransformerRef.current = tr;
      tr.on("transformend", () => {
        const t = bladeTransformFromGroup(
          group,
          labelX,
          labelY,
          widthMmRef.current,
          heightMmRef.current
        );
        onBladeTransformChange?.(t);
      });
      group.on("dragend", () => {
        const t = bladeTransformFromGroup(
          group,
          labelX,
          labelY,
          widthMmRef.current,
          heightMmRef.current
        );
        onBladeTransformChange?.(t);
      });
      editor.board.draw();
    },
    [onBladeTransformChange]
  );

  const renderBundle = useCallback(
    (editor: Pikaso, bundle: CutlineBundle) => {
      bundleRef.current = bundle;
      renderCutlineOverlays(editor, bundle, {
        labelX,
        labelY,
        labelWidthMm: widthMmRef.current,
        labelHeightMm: heightMmRef.current,
        layers: {
          cut: layersRef.current.cut,
          bleed: layersRef.current.bleed,
          safe: layersRef.current.safe,
        },
        bladeTransform: bladeTransformRef.current,
        bladeInteractive: editTargetRef.current === "blade",
      });
      syncBladeTransformer(editor);
    },
    [syncBladeTransformer]
  );

  const buildContourInput = useCallback(
    (
      blade: BladeShapeConfig,
      shape: ImageShape | null,
      img: HTMLImageElement | null,
      wMm: number,
      hMm: number,
      offMm: number
    ) => {
      const placementMm = shape
        ? (() => {
            const p = placementFromPikasoImage(shape).placementMm;
            // Board-mutlak → label-local: renderer grubu zaten {labelX,labelY}'ye kaydırıyor,
            // yani kontur yolları label köşesine göreli olmalı (rect/circle ile aynı çerçeve).
            return {
              ...p,
              x: p.x - labelX / EDITOR_PX_PER_MM,
              y: p.y - labelY / EDITOR_PX_PER_MM,
            };
          })()
        : undefined;
      return {
        mode: resolveMode(blade),
        labelWidthMm: wMm,
        labelHeightMm: hMm,
        offsetMm: offMm,
        smoothness: smoothnessRef.current,
        cornerRadiusMm:
          blade.kind === "rect" ? (blade.cornerRadiusMm ?? 0) : 0,
        image: img ?? undefined,
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
      if (!editor) return;
      const staticBlade = isStaticBlade(blade);
      if (!staticBlade && (!img || !shape)) return;

      if (blade.kind === "none") {
        clearCutlineOverlays(editor);
        bundleRef.current = null;
        return;
      }

      let bundle: CutlineBundle;
      if (blade.kind === "template") {
        const t = blade.template;
        const scale = Math.min(wMm / t.widthMm, hMm / t.heightMm);
        bundle = computeTemplateBundle({
          shape: t.shape,
          widthMm: wMm,
          heightMm: hMm,
          offsetMm: offMm,
          cornerRadiusMm: t.cornerRadiusMm * scale,
        });
      } else if (blade.kind === "rect" || blade.kind === "circle") {
        bundle = await computeCutlineBundle(
          buildContourInput(blade, null, null, wMm, hMm, offMm)
        );
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
    } catch (err) {
      console.error("[editor] OpenCV refine failed:", err);
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
      if (isStaticBlade(blade)) {
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

  const applyImagePreset = useCallback(
    (preset: PlacementPreset) => {
      const shape = imageShapeRef.current;
      const img = htmlImageRef.current;
      if (!shape || !img) return;
      const frame = labelPlacementFrame(
        labelX,
        labelY,
        widthMmRef.current,
        heightMmRef.current
      );

      if (preset === "center") {
        const sx = shape.scaleX();
        const sy = shape.scaleY();
        const scaledW = img.naturalWidth * Math.abs(sx);
        const scaledH = img.naturalHeight * Math.abs(sy);
        let targetCx = frame.cx;
        let targetCy = frame.cy;
        const cut = bundleRef.current?.cut;
        if (cut && cut.length) {
          const c = ringCenterMm(cut);
          if (Number.isFinite(c.x)) {
            targetCx = mmToPx(c.x);
            targetCy = mmToPx(c.y);
          }
        }
        shape.update({
          x: targetCx - scaledW / 2,
          y: targetCy - scaledH / 2,
        });
        imageShapeRef.current?.select();
        scheduleRecomputeCutline({ fastImmediate: true });
        return;
      }

      const attrs = imageAttrsForPreset(
        preset,
        frame,
        img.naturalWidth,
        img.naturalHeight
      );
      shape.update({
        ...attrs,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      imageShapeRef.current?.select();
      scheduleRecomputeCutline({ fastImmediate: true });
    },
    [scheduleRecomputeCutline]
  );

  const fitImageContain = useCallback(() => {
    applyImagePreset("contain");
  }, [applyImagePreset]);

  const fitImageCenter = useCallback(() => {
    applyImagePreset("center");
  }, [applyImagePreset]);

  const fitImageCover = useCallback(() => {
    applyImagePreset("cover");
  }, [applyImagePreset]);

  /** Opak içerik label'ı doldursun — şeffaf kenarlar kırpılmış bbox ile cover */
  const fitImageOpaqueCover = useCallback(() => {
    const shape = imageShapeRef.current;
    const img = htmlImageRef.current;
    if (!shape || !img) return;

    const wMm = widthMmRef.current;
    const hMm = heightMmRef.current;
    const bounds = getOpaqueBoundsPx(img);
    const contentW = Math.max(1, bounds.w);
    const contentH = Math.max(1, bounds.h);

    const aspect = contentW / contentH;
    let drawWMm = wMm;
    let drawHMm = drawWMm / aspect;
    if (drawHMm < hMm) {
      drawHMm = hMm;
      drawWMm = drawHMm * aspect;
    }
    const scale = mmToPx(drawWMm) / contentW;

    const drawAreaX = labelX + mmToPx((wMm - drawWMm) / 2);
    const drawAreaY = labelY + mmToPx((hMm - drawHMm) / 2);

    shape.update({
      x: drawAreaX - bounds.x * scale,
      y: drawAreaY - bounds.y * scale,
      width: img.naturalWidth,
      height: img.naturalHeight,
      scaleX: scale,
      scaleY: scale,
    });
    imageShapeRef.current?.select();
    scheduleRecomputeCutline({ fastImmediate: true });
  }, [scheduleRecomputeCutline]);

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

      const bounds = getOpaqueBoundsPx(htmlImg);
      const contentW = bounds.w;
      const contentH = bounds.h;

      const shape = await editor.shapes.image.insert(file, {
        x: labelX,
        y: labelY,
        width: natW,
        height: natH,
        scaleX: 1,
        scaleY: 1,
        draggable: true,
        name: USER_IMAGE_NAME,
      });
      imageShapeRef.current = shape;
      fitImageOpaqueCover();
      shape.select();
      syncLabelWorkspace();
      syncEditorZOrder(editor);

      onDesignLoaded?.({ widthPx: contentW, heightPx: contentH });
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
    fitImageOpaqueCover,
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
    const exportBundle = applyBladeTransformToBundle(
      bundle,
      widthMm,
      heightMm,
      bladeTransformRef.current
    );
    const svg = buildCutlineSvgMm({
      bundle: exportBundle,
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
        smoothness: smoothnessRef.current,
        widthMm,
        heightMm,
        bundle: exportBundle,
        imagePlacement: {
          x: placementMm.x,
          y: placementMm.y,
          scale,
        },
        bladeTransform: bladeTransformRef.current,
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
      fitCenter: () => fitImageCenter(),
      fitCover: () => fitImageCover(),
      requestExport: () => {
        void exportCutline();
      },
      setLayerVisibility: () => {
        /* Katman görünürlüğü layers prop effect ile — OpenCV yok */
      },
      setEditTarget: (target: EditorEditTarget) => {
        editTargetRef.current = target;
        const editor = editorRef.current;
        if (!editor) return;
        if (target === "blade") {
          imageShapeRef.current?.deselect();
        } else {
          imageShapeRef.current?.select();
        }
        if (bundleRef.current) {
          renderBundle(editor, bundleRef.current);
        }
      },
      isReady: () => ready && !!imageShapeRef.current,
      isCutlineReady: () => {
        const blade = bladeShapeRef.current;
        if (blade.kind === "none") return false;
        return bundleRef.current != null;
      },
      isContourRefining: () => contourRefiningRef.current,
    }),
    [
      exportCutline,
      fitImageContain,
      fitImageCenter,
      fitImageCover,
      ready,
      renderBundle,
      editorRef,
    ]
  );

  const loadDesignRef = useRef(loadDesign);
  loadDesignRef.current = loadDesign;

  useEffect(() => {
    if (!designUrl) {
      loadedUrlRef.current = null;
    }
  }, [designUrl]);

  useEffect(() => {
    if (!ready) return;
    void preloadContourWorker();
    return () => {
      terminateContourWorker();
    };
  }, [ready]);

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
    if (!ready || !htmlImageRef.current || !imageShapeRef.current) return;
    fitImageOpaqueCover();
  }, [widthMm, heightMm, ready, fitImageOpaqueCover]);

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
  }, [widthMm, heightMm, offsetMm, smoothness, bladeShape, scheduleRecomputeCutline]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready || !bundleRef.current) return;
    renderBundle(editor, bundleRef.current);
  }, [bladeTransform, editTarget, ready, renderBundle, editorRef]);

  useEffect(() => {
    const editor = editorRef.current;
    const bundle = bundleRef.current;
    if (!editor || !ready || !bundle) return;
    renderCutlineOverlays(editor, bundle, {
      labelX,
      labelY,
      labelWidthMm: widthMm,
      labelHeightMm: heightMm,
      layers: {
        cut: layers.cut,
        bleed: layers.bleed,
        safe: layers.safe,
      },
      bladeTransform,
      bladeInteractive: editTarget === "blade",
    });
    syncBladeTransformer(editor);
  }, [
    layers.cut,
    layers.bleed,
    layers.safe,
    ready,
    editorRef,
    widthMm,
    heightMm,
    bladeTransform,
    editTarget,
    syncBladeTransformer,
  ]);

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
      bladeTransformerRef.current?.destroy();
      bladeTransformerRef.current = null;
      terminateContourWorker();
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
