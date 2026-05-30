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
