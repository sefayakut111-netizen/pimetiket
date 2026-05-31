import { mmToPx } from "@/lib/editor/coords";
import { LABEL_ORIGIN_X, LABEL_ORIGIN_Y } from "@/lib/editor/pikaso/world-coords";
import type Pikaso from "pikaso";

const FIT_PADDING = 0.85;

export interface ViewTransformInput {
  stageWidth: number;
  stageHeight: number;
  widthMm: number;
  heightMm: number;
  viewZoom: number;
  labelX?: number;
  labelY?: number;
}

/** Görünüm transformu — world node koordinatlarını değiştirmez. */
export function computeViewTransform(input: ViewTransformInput): {
  effScale: number;
  position: { x: number; y: number };
} {
  const labelX = input.labelX ?? LABEL_ORIGIN_X;
  const labelY = input.labelY ?? LABEL_ORIGIN_Y;
  const contentW = mmToPx(input.widthMm);
  const contentH = mmToPx(input.heightMm);
  const fitScale =
    Math.min(input.stageWidth / contentW, input.stageHeight / contentH) *
    FIT_PADDING;
  const effScale = fitScale * input.viewZoom;
  const centerX = labelX + contentW / 2;
  const centerY = labelY + contentH / 2;
  return {
    effScale,
    position: {
      x: input.stageWidth / 2 - centerX * effScale,
      y: input.stageHeight / 2 - centerY * effScale,
    },
  };
}

export function applyViewTransform(
  editor: Pikaso,
  input: ViewTransformInput
): void {
  const { effScale, position } = computeViewTransform(input);
  editor.board.stage.scale({ x: effScale, y: effScale });
  editor.board.stage.position(position);
  editor.board.draw();
}
