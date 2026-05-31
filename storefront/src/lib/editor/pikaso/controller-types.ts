import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";
import type { DieCutTemplate } from "@/lib/templates/die-cut-templates";
import type { CutlineMode } from "@/lib/editor/cutline/types";
import type { BladeTransformMm } from "@/lib/editor/pikaso/blade-transform";

export type AutoCutMode = "contour" | "hull" | "rect" | "circle";

export type BladeShapeConfig =
  | { kind: "none" }
  | { kind: "contour" | "hull" }
  | {
      kind: "template";
      template: DieCutTemplate;
      mode: CutlineMode;
    }
  | { kind: "rect" | "circle"; cornerRadiusMm?: number };

export type EditorEditTarget = "image" | "blade";

export interface PikasoEditorController {
  fitContain(): void;
  fitCenter(): void;
  fitCover(): void;
  requestExport(): void;
  setLayerVisibility(layer: EditorLayer, on: boolean): void;
  setEditTarget(target: EditorEditTarget): void;
  isReady(): boolean;
  isCutlineReady(): boolean;
  isContourRefining(): boolean;
}
