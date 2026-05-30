"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface EditorCanvasHandle {
  postMessage: (msg: object) => void;
}

interface EditorCanvasProps {
  iframeSrc: string | null;
  onSaved: (payload: {
    svg: string;
    preview_png_base64: string | null;
    meta: Record<string, unknown>;
  }) => void;
  onReady?: () => void;
  onDesignLoaded?: (dims: { widthPx: number; heightPx: number }) => void;
  onError?: (msg: string) => void;
  /** Headless POC — sabit yükseklik */
  fixedHeight?: number;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(
  function EditorCanvas(
    { iframeSrc, onSaved, onReady, onDesignLoaded, onError, fixedHeight },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(fixedHeight ?? 720);

    useImperativeHandle(ref, () => ({
      postMessage(msg: object) {
        iframeRef.current?.contentWindow?.postMessage(
          msg,
          window.location.origin
        );
      },
    }));

    useEffect(() => {
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        const msg = e.data;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "pim-poc-ready") {
          onReady?.();
        }
        if (msg.type === "pim-poc-loaded") {
          onReady?.();
          const w = Number(msg.width);
          const h = Number(msg.height);
          if (w > 0 && h > 0) {
            onDesignLoaded?.({ widthPx: w, heightPx: h });
          }
        }
        if (msg.type === "pim-poc-error") {
          onError?.(String(msg.error ?? "POC hatası"));
        }
        if (
          !fixedHeight &&
          msg.type === "pim-poc-resize" &&
          typeof msg.height === "number"
        ) {
          setHeight(Math.min(Math.max(msg.height, 480), 1200));
        }
        if (msg.type === "pim-editor-saved") {
          onSaved({
            svg: msg.svg,
            preview_png_base64: msg.preview_png_base64 ?? null,
            meta: (msg.meta as Record<string, unknown>) ?? {},
          });
        }
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [onSaved, onReady, onDesignLoaded, onError, fixedHeight]);

    if (!iframeSrc) {
      return (
        <div className="h-[480px] grid place-items-center text-gri-600 text-sm rounded-xl bg-gri-50">
          Editör yükleniyor…
        </div>
      );
    }

    return (
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Bıçak editörü"
        className="w-full border-0 rounded-xl bg-gri-50"
        style={{ height: fixedHeight ?? height }}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }
);
