import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";
import type { DieCutTemplate } from "@/lib/templates/die-cut-templates";
import type { CutlineMode } from "@/lib/editor/cutline/types";

export type BladeShapeConfig =
  | { kind: "none" }
  | { kind: "contour" | "hull" }
  | {
      kind: "template";
      template: DieCutTemplate;
      mode: CutlineMode;
    }
  | { kind: "rect" | "circle"; cornerRadiusMm?: number };

export interface PikasoEditorController {
  fitContain(): void;
  requestExport(): void;
  setLayerVisibility(layer: EditorLayer, on: boolean): void;
  isReady(): boolean;
  /** Kesim bundle hazır (hızlı önizleme veya şablon) */
  isCutlineReady(): boolean;
  /** OpenCV kontur iyileştirmesi sürüyor */
  isContourRefining(): boolean;
}
