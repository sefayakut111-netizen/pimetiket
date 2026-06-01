/** Editör → konfigüratör sessionStorage handoff (reprint deseni). */

export const EDITOR_SESSION_KEY = "pim_editor_design";

export interface EditorHandoffPayload {
  tempId: string;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  editorCutlineDraftId?: string;
  widthMm: number;
  heightMm: number;
}

/** POC standalone → parent (pim-editor-saved) meta */
export interface PocCutlineMeta {
  source: "raster" | "vector" | "vector-with-cutline" | "psd" | string;
  mode: "contour" | "hull" | "rect" | "circle" | string;
  offset_mm: number | null;
  smoothness: number | null;
  dpi: number | null;
  width_mm: number | null;
  height_mm: number | null;
  cutline_width_mm: number | null;
  cutline_height_mm: number | null;
  material_type?: string | null;
  image_placement?: { x: number; y: number; scale: number } | null;
}

export interface PocEditorSavedPayload {
  type: "pim-editor-saved";
  svg: string;
  meta: PocCutlineMeta;
  preview_png_base64: string | null;
}

export interface PocDesignFilePayload {
  type: "pim-design-file";
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  base64?: string;
  error?: string;
}

export function deriveEditorProductHint(meta: PocCutlineMeta | null): {
  primary: "sticker" | "etiket" | null;
  message: string | null;
} {
  if (!meta) return { primary: null, message: null };
  if (meta.mode === "circle") {
    return {
      primary: "sticker",
      message: "Yuvarlak kesim → Sticker önerilir",
    };
  }
  const w = meta.width_mm ?? 0;
  const h = meta.height_mm ?? 0;
  if (meta.mode === "rect" && w > 0 && h > 0) {
    const rollTendency =
      w >= h * 1.8 || h >= w * 1.8 || w * h >= 2500;
    if (rollTendency) {
      return {
        primary: "etiket",
        message: "Dikdörtgen / rulo kesim → Etiket önerilir",
      };
    }
  }
  return { primary: null, message: null };
}

export function readEditorHandoff(): EditorHandoffPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EDITOR_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorHandoffPayload;
    if (!parsed?.tempId || !parsed.widthMm || !parsed.heightMm) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearEditorHandoff(): void {
  try {
    sessionStorage.removeItem(EDITOR_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function writeEditorHandoff(payload: EditorHandoffPayload): void {
  sessionStorage.setItem(EDITOR_SESSION_KEY, JSON.stringify(payload));
}
