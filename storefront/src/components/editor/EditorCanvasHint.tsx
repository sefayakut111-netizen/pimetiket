"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export const EDITOR_CANVAS_HINT_KEY = "pim_editor_canvas_hint";

interface EditorCanvasHintProps {
  visible: boolean;
  onDismiss: () => void;
}

export function EditorCanvasHint({ visible, onDismiss }: EditorCanvasHintProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFading(false);
    const t = window.setTimeout(() => {
      setFading(true);
      window.setTimeout(onDismiss, 280);
    }, 6000);
    return () => window.clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible && !fading) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-[90%] -translate-x-1/2",
        "rounded-md bg-lacivert/90 px-3 py-2 text-center text-[12px] text-white shadow-1",
        "transition-opacity duration-300",
        fading ? "opacity-0" : "opacity-100"
      )}
      role="status"
      aria-live="polite"
    >
      Görseli sürükle · köşeden boyutlandır · üstten Sığdır.
    </div>
  );
}

export function isCanvasHintSeen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(EDITOR_CANVAS_HINT_KEY) === "1";
}

export function markCanvasHintSeen(): void {
  localStorage.setItem(EDITOR_CANVAS_HINT_KEY, "1");
}
