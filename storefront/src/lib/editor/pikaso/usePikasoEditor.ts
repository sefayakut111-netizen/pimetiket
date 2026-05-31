"use client";

import Pikaso from "pikaso";
import { useEffect, useRef, useState } from "react";

const DEFAULT_STAGE_W = 800;
const DEFAULT_STAGE_H = 520;

/** Pikaso arka planı — dış kareli CSS görünsün */
function configureTransparentStage(editor: Pikaso) {
  const container = editor.board.container;
  if (container) container.style.background = "transparent";
  const content = editor.board.stage.getContent();
  if (content) content.style.background = "transparent";
  try {
    editor.board.background.fill("transparent");
  } catch {
    /* background.fill */
  }
  try {
    editor.board.background.overlay.node.visible(false);
  } catch {
    /* overlay */
  }
}

/**
 * Pikaso v3 mount — tek sefer; stage boyutu ResizeObserver ile güncellenir.
 */
export function usePikasoEditor(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialSize?: { width: number; height: number }
) {
  const editorRef = useRef<Pikaso | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const width = Math.max(
      1,
      el.clientWidth || initialSize?.width || DEFAULT_STAGE_W
    );
    const height = Math.max(
      1,
      el.clientHeight || initialSize?.height || DEFAULT_STAGE_H
    );

    const editor = new Pikaso({
      container: el,
      width,
      height,
      disableCanvasContextMenu: true,
      selection: {
        interactive: true,
        transformer: {
          rotateEnabled: true,
          enabledAnchors: [
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ],
        },
      },
    });
    configureTransparentStage(editor);
    editorRef.current = editor;
    setReady(true);

    return () => {
      try {
        editor.reset();
      } catch {
        /* reset */
      }
      try {
        editor.board.stage.destroy();
      } catch {
        /* stage.destroy */
      }
      el.innerHTML = "";
      editorRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; resize via stage.size()
  }, [containerRef]);

  return { editorRef, ready };
}
