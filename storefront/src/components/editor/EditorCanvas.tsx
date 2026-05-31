"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";
import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";
import type {
  AutoCutMode,
  BladeShapeConfig,
  EditorEditTarget,
  PikasoEditorController,
} from "@/lib/editor/pikaso/controller-types";
import type { BladeTransformMm } from "@/lib/editor/pikaso/blade-transform";

const PikasoEditorCanvas = dynamic(
  () =>
    import("@/components/editor/PikasoEditorCanvas").then(
      (m) => m.PikasoEditorCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[200px] items-center justify-center bg-gri-50 text-sm text-gri-600">
        Editör tuvali yükleniyor…
      </div>
    ),
  }
);

export type EditorCanvasHandle = PikasoEditorController;

interface EditorCanvasProps {
  designUrl: string | null;
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
  onSaved: (payload: {
    svg: string;
    preview_png_base64: string | null;
    meta: Record<string, unknown>;
  }) => void;
  onReady?: () => void;
  onDesignLoaded?: (dims: { widthPx: number; heightPx: number }) => void;
  onError?: (msg: string) => void;
  onContourRefining?: (refining: boolean) => void;
  fixedHeight?: number;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(
  function EditorCanvas(props, ref) {
    const {
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
      onSaved,
      onReady,
      onDesignLoaded,
      onError,
      onContourRefining,
      fixedHeight = 520,
    } = props;

    if (!designUrl) {
      return (
        <div className="flex h-[480px] items-center justify-center rounded-xl bg-gri-50 text-sm text-gri-600">
          Editör yükleniyor…
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <PikasoEditorCanvas
          ref={ref}
          designUrl={designUrl}
          widthMm={widthMm}
          heightMm={heightMm}
          offsetMm={offsetMm}
          smoothness={smoothness}
          viewZoom={viewZoom}
          layers={layers}
          bladeShape={bladeShape}
          bladeTransform={bladeTransform}
          editTarget={editTarget}
          onBladeTransformChange={onBladeTransformChange}
          fixedHeight={fixedHeight}
          onSaved={onSaved}
          onReady={onReady}
          onDesignLoaded={onDesignLoaded}
          onError={onError}
          onContourRefining={onContourRefining}
        />
      </div>
    );
  }
);
