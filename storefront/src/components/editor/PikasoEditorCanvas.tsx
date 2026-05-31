"use client";

import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";
import { mmToPx } from "@/lib/editor/coords";
import {
  computeCutlineBundle,
  computeTemplateBundle,
} from "@/lib/editor/cutline/compute";
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
}

type ImageShape = Awaited<ReturnType<Pikaso["shapes"]["image"]["insert"]>>;

const labelX = LABEL_ORIGIN_X;
const labelY = LABEL_ORIGIN_Y;

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
  const loadedUrlRef = useRef<string | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const widthMmRef = useRef(widthMm);
  const heightMmRef = useRef(heightMm);
  const viewZoomRef = useRef(viewZoom);
  const lastStageSizeRef = useRef({ w: 0, h: 0 });
  const resizeRafRef = useRef<number | null>(null);
  widthMmRef.current = widthMm;
  heightMmRef.current = heightMm;
  viewZoomRef.current = viewZoom;

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
    if (last.w === w && last.h === h) return;
    lastStageSizeRef.current = { w, h };
    editor.board.stage.size({ width: w, height: h });
    syncViewTransform();
  }, [editorRef, syncViewTransform]);

  const recomputeCutline = useCallback(async () => {
    const editor = editorRef.current;
    const img = htmlImageRef.current;
    const shape = imageShapeRef.current;
    if (!editor || !img || !shape) return;

    if (bladeShape.kind === "none") {
      clearCutlineOverlays(editor);
      bundleRef.current = null;
      syncViewTransform();
      return;
    }

    const { placementMm } = placementFromPikasoImage(shape);
    let bundle: CutlineBundle;

    if (bladeShape.kind === "template") {
      const t = bladeShape.template;
      bundle = computeTemplateBundle({
        shape: t.shape,
        widthMm: t.widthMm,
        heightMm: t.heightMm,
        offsetMm,
      });
    } else {
      bundle = await computeCutlineBundle({
        mode: resolveMode(bladeShape),
        labelWidthMm: widthMm,
        labelHeightMm: heightMm,
        offsetMm,
        cornerRadiusMm:
          bladeShape.kind === "rect" ? (bladeShape.cornerRadiusMm ?? 0) : 0,
        image: img,
        imagePlacementMm: placementMm,
      });
    }

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
    syncViewTransform();
  }, [bladeShape, editorRef, heightMm, offsetMm, syncViewTransform, widthMm]);

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
    void recomputeCutline();
  }, [heightMm, recomputeCutline, widthMm]);

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
      const img = await createImageBitmap(blob);
      const natW = img.width;
      const natH = img.height;
      img.close();

      editor.reset();
      imageShapeRef.current = null;
      bundleRef.current = null;

      const htmlImg = new window.Image();
      htmlImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        htmlImg.onload = () => resolve();
        htmlImg.onerror = () => reject(new Error("image decode"));
        htmlImg.src = URL.createObjectURL(blob);
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

      onDesignLoaded?.({ widthPx: natW, heightPx: natH });
      await recomputeCutline();
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
    recomputeCutline,
    syncViewTransform,
    widthMm,
  ]);

  const exportCutline = useCallback(() => {
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
  ]);

  useImperativeHandle(
    ref,
    () => ({
      fitContain: () => fitImageContain(),
      requestExport: () => exportCutline(),
      setLayerVisibility: () => {
        /* Katman görünürlüğü layers prop effect ile — OpenCV yok */
      },
      isReady: () => ready && !!imageShapeRef.current,
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
    if (!ready) return;
    if (loadedUrlRef.current === designUrl) return;
    loadedUrlRef.current = designUrl;
    void loadDesignRef.current();
  }, [designUrl, ready]);

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
    void recomputeCutline();
  }, [widthMm, heightMm, offsetMm, bladeShape, recomputeCutline]);

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
    syncViewTransform();
  }, [
    layers.cut,
    layers.bleed,
    layers.safe,
    ready,
    editorRef,
    syncViewTransform,
  ]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready) return;
    const bump = () => void recomputeCutline();
    editor.on(
      ["selection:dragend", "selection:transformend", "shape:move", "shape:rotate"],
      bump
    );
    return () => {
      editor.off(
        ["selection:dragend", "selection:transformend", "shape:move", "shape:rotate"],
        bump
      );
    };
  }, [ready, editorRef, recomputeCutline]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-0 overflow-hidden bg-gri-50"
    />
  );
});
