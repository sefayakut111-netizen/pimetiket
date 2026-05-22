/**
 * useVisionFallback — Pim Vision 2. katman cutline fallback hook'u.
 *
 * Sefa 22 May v68 (Faz 3 — POC entegrasyon ortak helper):
 * POC iframe'i partCount=0 / coverage>0.95 / partCount>8 durumunda parent'a
 * `pim-vision-fallback-needed` postMessage atar. Bu hook:
 *   1. window'a message listener register eder (filter: vision-fallback)
 *   2. /api/pim/cutline-vision-fallback'i çağırır
 *   3. State'i UI'ya verir → banner çizimi sayfa sorumluluğunda
 *
 * Hem `/siparis/[id]` (ProofPreviewBox) hem `/onay/[orderId]/duzenle/[itemId]`
 * (POC editor) sayfası kullanır.
 *
 * Endpoint design_file_id veya itemId kabul eder; itemId daha kolay (POC her
 * zaman biliyor).
 */

"use client";

import { useEffect, useState } from "react";

export interface VisionFallbackState {
  diagnosis: string;
  severity: "warn" | "err";
  suggested_action: string;
  pim_message: string;
  loading?: boolean;
  fallback?: boolean;
}

export interface UseVisionFallbackOpts {
  orderId: string | null;
  itemId: string | null;
  /** Hangi iframe'den geliyor — başkalarının mesajını yutmamak için */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function useVisionFallback(opts: UseVisionFallbackOpts) {
  const [state, setState] = useState<VisionFallbackState | null>(null);
  const { orderId, itemId, iframeRef } = opts;

  useEffect(() => {
    if (!orderId || !itemId) return;
    function onMsg(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow)
        return;
      const msg = e.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type !== "pim-vision-fallback-needed") return;
      const kind = String(msg.kind || "no_contours");
      const metadata =
        msg.metadata && typeof msg.metadata === "object" ? msg.metadata : undefined;
      console.log("[useVisionFallback] tetiklendi:", kind, metadata);
      setState({
        diagnosis: "",
        severity: "warn",
        suggested_action: "",
        pim_message: "Pim AI Vision tanı koyuyor…",
        loading: true,
      });
      void fetch("/api/pim/cutline-vision-fallback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, itemId, kind, metadata }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const err = (await r.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error || `status_${r.status}`);
          }
          return r.json() as Promise<
            VisionFallbackState & { ok?: boolean }
          >;
        })
        .then((data) => {
          setState({
            diagnosis: data.diagnosis,
            severity: data.severity,
            suggested_action: data.suggested_action,
            pim_message: data.pim_message,
            loading: false,
            fallback: data.fallback,
          });
        })
        .catch((err) => {
          console.warn("[useVisionFallback] fail:", err);
          setState(null); // sessiz fail — POC rule-based zaten gösteriyor
        });
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [orderId, itemId, iframeRef]);

  return {
    visionFallback: state,
    dismiss: () => setState(null),
  };
}
