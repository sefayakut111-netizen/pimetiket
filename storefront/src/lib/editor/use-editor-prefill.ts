"use client";

import { useEffect, useRef } from "react";
import type { DesignTempState } from "@/components/ui/DesignDropZone";
import {
  clearEditorHandoff,
  readEditorHandoff,
} from "@/lib/editor/editor-handoff";

/**
 * ?from=editor — sessionStorage handoff okuma (reprint deseni).
 */
export function useEditorPrefill(args: {
  onDesign: (design: DesignTempState) => void;
  onDimensions: (w: number, h: number) => void;
  onCutlineDraftId: (id: string) => void;
  toastInfo?: (msg: string) => void;
}) {
  const applied = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || applied.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("from") !== "editor") return;

    const payload = readEditorHandoff();
    if (!payload) return;

    applied.current = true;
    clearEditorHandoff();

    args.onDesign({
      tempId: payload.tempId,
      previewUrl: payload.previewUrl,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      generatedPreviewUrl: payload.previewUrl,
    });
    args.onDimensions(payload.widthMm, payload.heightMm);
    if (payload.editorCutlineDraftId) {
      args.onCutlineDraftId(payload.editorCutlineDraftId);
    }
    args.toastInfo?.("Editörden geldi — ölçü ve tasarım ön-dolu");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
