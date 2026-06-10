/**
 * Pim editör komut → EditorShell postMessage dispatch.
 */
import type { Dispatch, SetStateAction } from "react";
import type { PimEditorCommand } from "@/lib/editor/pim-command-schema";
import { roundEditorMm } from "@/lib/editor/coords";
import { SIZE_REFERENCES } from "@/lib/editor/size-references";
import { DIE_CUT_BY_ID } from "@/lib/templates/die-cut-templates";
import type { EditorLayer } from "@/components/editor/EditorPreviewToolbar";

function triggerFitContain(
  postToPoc: (payload: Record<string, unknown>) => void
) {
  postToPoc({ type: "pim-fit-contain" });
}

export type CutMode = "contour" | "hull" | "rect" | "circle";

export interface PimCommandDispatchContext {
  widthMm: number;
  heightMm: number;
  postToPoc: (payload: Record<string, unknown>) => void;
  setWidthMm: (w: number) => void;
  setHeightMm: (h: number) => void;
  setCutMode: (mode: CutMode) => void;
  setCutlineReady: (ready: boolean) => void;
  setImageScalePct: (pct: number) => void;
  setLayers: Dispatch<SetStateAction<Record<EditorLayer, boolean>>>;
  handleRemoveBg: () => void;
  syncSizeToPoc: (w: number, h: number) => void;
  applyCoordinatedScale?: (pct: number) => void;
  applyCoordinatedSize?: (w: number, h: number) => void;
  setBaseFromSize?: (w: number, h: number, scalePct: number) => void;
}

export type PimCommandResult =
  | { ok: true }
  | { ok: false; reason: string };

export function dispatchPimCommand(
  command: PimEditorCommand,
  ctx: PimCommandDispatchContext
): PimCommandResult {
  const {
    widthMm,
    heightMm,
    postToPoc,
    setWidthMm,
    setHeightMm,
    setCutMode,
    setCutlineReady,
    setImageScalePct,
    setLayers,
    handleRemoveBg,
    syncSizeToPoc,
    applyCoordinatedScale,
    applyCoordinatedSize,
    setBaseFromSize,
  } = ctx;

  switch (command.action) {
    case "set_size": {
      const w = roundEditorMm(command.widthMm ?? widthMm);
      const h = roundEditorMm(command.heightMm ?? heightMm);
      if (applyCoordinatedSize) {
        applyCoordinatedSize(w, h);
      } else {
        setWidthMm(w);
        setHeightMm(h);
        syncSizeToPoc(w, h);
      }
      triggerFitContain(postToPoc);
      return { ok: true };
    }
    case "set_size_from_reference": {
      const w = roundEditorMm(command.estimatedWidthMm ?? widthMm);
      const h = roundEditorMm(command.estimatedHeightMm ?? heightMm);
      if (applyCoordinatedSize) {
        applyCoordinatedSize(w, h);
      } else {
        setWidthMm(w);
        setHeightMm(h);
        syncSizeToPoc(w, h);
      }
      setBaseFromSize?.(w, h, 100);
      const ref =
        SIZE_REFERENCES.find((r) => r.labelTr === command.referenceKey) ??
        SIZE_REFERENCES.find(
          (r) =>
            Math.abs(r.widthMm - w) < 0.5 && Math.abs(r.heightMm - h) < 0.5
        );
      if (ref) {
        const mode: CutMode = ref.shape === "circle" ? "circle" : "rect";
        setCutMode(mode);
        setCutlineReady(false);
        postToPoc({
          type: "pim-editor-set-shape",
          shape: ref.shape,
          mode,
          widthMm: w,
          heightMm: h,
        });
      }
      triggerFitContain(postToPoc);
      return { ok: true };
    }
    case "set_cut_offset":
      postToPoc({ type: "pim-set-offset", offsetMm: command.offsetMm });
      return { ok: true };
    case "set_smoothness":
      postToPoc({ type: "pim-set-smoothness", smoothness: command.smoothness });
      return { ok: true };
    case "apply_auto_cut": {
      const mode: CutMode = command.mode === "hull" ? "hull" : "contour";
      setCutMode(mode);
      setCutlineReady(false);
      postToPoc({
        type: "pim-editor-set-shape",
        mode,
        widthMm,
        heightMm,
      });
      triggerFitContain(postToPoc);
      return { ok: true };
    }
    case "apply_shape_cut": {
      const mode: CutMode = command.shape === "circle" ? "circle" : "rect";
      setCutMode(mode);
      setCutlineReady(false);
      postToPoc({
        type: "pim-editor-set-shape",
        shape: command.shape,
        mode,
        widthMm,
        heightMm,
      });
      triggerFitContain(postToPoc);
      return { ok: true };
    }
    case "apply_template": {
      const tpl = DIE_CUT_BY_ID.get(command.templateId);
      if (!tpl) {
        return { ok: false, reason: "Şablon bulunamadı" };
      }
      const mode: CutMode =
        tpl.shape === "circle"
          ? "circle"
          : tpl.shape === "rect" || tpl.shape === "ellipse"
            ? "rect"
            : "contour";
      setCutMode(mode);
      setCutlineReady(false);
      setBaseFromSize?.(tpl.widthMm, tpl.heightMm, 100);
      if (applyCoordinatedSize) {
        applyCoordinatedSize(tpl.widthMm, tpl.heightMm);
      } else {
        setWidthMm(tpl.widthMm);
        setHeightMm(tpl.heightMm);
        syncSizeToPoc(tpl.widthMm, tpl.heightMm);
      }
      postToPoc({
        type: "pim-editor-set-shape",
        shape: tpl.shape,
        mode,
        widthMm: tpl.widthMm,
        heightMm: tpl.heightMm,
      });
      triggerFitContain(postToPoc);
      return { ok: true };
    }
    case "toggle_layer":
      setLayers((prev) => ({ ...prev, [command.layer]: command.on }));
      postToPoc({
        type: "pim-toggle-layer",
        layer: command.layer,
        on: command.on,
      });
      return { ok: true };
    case "remove_background":
      handleRemoveBg();
      return { ok: true };
    case "fit_view": {
      const type =
        command.mode === "center"
          ? "pim-fit-center"
          : command.mode === "cover"
            ? "pim-fit-cover"
            : "pim-fit-contain";
      postToPoc({ type });
      return { ok: true };
    }
    case "align":
      postToPoc({ type: "pim-fit-center" });
      return { ok: true };
    case "center_blade":
      postToPoc({ type: "pim-fit-center" });
      return { ok: true };
    case "set_image_scale": {
      const pct = Math.max(25, Math.min(200, command.scalePct));
      if (applyCoordinatedScale) {
        applyCoordinatedScale(pct);
      } else {
        setImageScalePct(pct);
        postToPoc({ type: "pim-set-image-scale", scale: pct / 100 });
      }
      return { ok: true };
    }
    case "suggest_product":
      return { ok: false, reason: "Ürün önerisi şu an uygulanamıyor" };
    case "clarify":
      return { ok: false, reason: command.question };
    case "reject":
      return { ok: false, reason: command.reason };
    default:
      return { ok: false, reason: "Bu komut desteklenmiyor" };
  }
}
