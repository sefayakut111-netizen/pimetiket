"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export type EnhanceResult = {
  originalPreviewUrl: string | null;
  enhancedPreviewUrl: string | null;
  enhancedTempDesignId: string;
  originalWidth?: number;
  originalHeight?: number;
  enhancedWidth?: number;
  enhancedHeight?: number;
  scale?: number;
};

interface ImageEnhancePromptBase {
  effectiveDpi?: number | null;
  originalPreviewUrl?: string | null;
  onReject: () => void;
}

interface ImageEnhanceProofProps extends ImageEnhancePromptBase {
  mode: "proof";
  orderId: string;
  itemId: string;
  designFileId: string;
  onAccepted: () => void;
}

interface ImageEnhanceEditorProps extends ImageEnhancePromptBase {
  mode: "editor";
  onEnhanceRequest: () => Promise<EnhanceResult | null>;
  onAcceptEnhanced: (result: EnhanceResult) => void | Promise<void>;
}

export type ImageEnhancePromptProps =
  | ImageEnhanceProofProps
  | ImageEnhanceEditorProps;

export function ImageEnhancePrompt(props: ImageEnhancePromptProps) {
  const [loading, setLoading] = useState<"enhance" | "accept" | "reject" | null>(
    null
  );
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dpiLabel =
    props.effectiveDpi != null
      ? ` (≈${Math.round(props.effectiveDpi)} DPI)`
      : "";

  const runEnhance = async () => {
    setLoading("enhance");
    setError(null);
    try {
      if (props.mode === "editor") {
        const r = await props.onEnhanceRequest();
        if (!r) {
          setError("İyileştirme şu an kullanılamıyor — orijinal korunuyor.");
          return;
        }
        setResult(r);
        return;
      }

      const res = await fetch("/api/design/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: props.orderId,
          designFileId: props.designFileId,
        }),
      });
      const j = (await res.json()) as EnhanceResult & {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.enhancedTempDesignId) {
        const msg =
          j.error === "budget_exceeded"
            ? "Günlük AI limiti doldu — orijinali kullanabilirsin."
            : j.error === "rate_limit_exceeded"
              ? "Günlük iyileştirme limitine ulaştın."
              : "İyileştirme başarısız — orijinal korunuyor.";
        setError(msg);
        return;
      }
      setResult({
        originalPreviewUrl: j.originalPreviewUrl ?? props.originalPreviewUrl ?? null,
        enhancedPreviewUrl: j.enhancedPreviewUrl ?? null,
        enhancedTempDesignId: j.enhancedTempDesignId,
        originalWidth: j.originalWidth,
        originalHeight: j.originalHeight,
        enhancedWidth: j.enhancedWidth,
        enhancedHeight: j.enhancedHeight,
        scale: j.scale,
      });
    } catch {
      setError("Bağlantı hatası — orijinal korunuyor.");
    } finally {
      setLoading(null);
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    setLoading("accept");
    setError(null);
    try {
      if (props.mode === "editor") {
        await props.onAcceptEnhanced(result);
        return;
      }

      const res = await fetch("/api/design/enhance/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: props.orderId,
          itemId: props.itemId,
          designFileId: props.designFileId,
          enhancedTempDesignId: result.enhancedTempDesignId,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setError(j.error ?? "Kayıt başarısız");
        return;
      }
      props.onAccepted();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    setError(null);
    try {
      if (props.mode === "proof") {
        await fetch(
          `/api/orders/${props.orderId}/proof/${props.itemId}/enhance-dismiss`,
          { method: "POST" }
        );
      }
      props.onReject();
    } finally {
      setLoading(null);
    }
  };

  const beforeUrl = result?.originalPreviewUrl ?? props.originalPreviewUrl;
  const afterUrl = result?.enhancedPreviewUrl;

  return (
    <div className="rounded-xl border-2 border-sari-koyu/30 bg-sari-soft/20 p-4">
      <p className="text-sm font-semibold text-lacivert">
        Bu görselin baskı kalitesi düşük görünüyor{dpiLabel}
      </p>
      <p className="mt-2 text-sm text-gri-700">
        AI ile çözünürlüğü artırabiliriz — önce öncesi/sonrasını karşılaştır,
        beğenirsen onayla. Metin veya logo bozulursa orijinali kullan.
      </p>

      {(beforeUrl || afterUrl) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-gri-700">Öncesi</p>
            {result?.originalWidth && result?.originalHeight ? (
              <p className="mb-1 text-[10px] text-gri-500">
                {result.originalWidth}×{result.originalHeight}px
              </p>
            ) : null}
            {beforeUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={beforeUrl}
                alt="Orijinal"
                className="max-h-40 w-full rounded border border-gri-200 object-contain bg-white"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded border border-dashed border-gri-300 text-xs text-gri-500">
                Orijinal
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gri-700">Sonrası</p>
            {result?.enhancedWidth && result?.enhancedHeight ? (
              <p className="mb-1 text-[10px] text-gri-500">
                {result.enhancedWidth}×{result.enhancedHeight}px
                {result.scale ? ` (${result.scale}×)` : ""}
              </p>
            ) : null}
            {afterUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={afterUrl}
                alt="İyileştirilmiş"
                className="max-h-40 w-full rounded border border-gri-200 object-contain bg-white"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded border border-dashed border-gri-300 text-xs text-gri-500">
                İyileştirince önizleme
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-kirmizi">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!result ? (
          <Button
            variant="primary"
            size="sm"
            disabled={loading !== null}
            onClick={() => void runEnhance()}
          >
            {loading === "enhance" ? "İyileştiriliyor…" : "AI ile iyileştir"}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={loading !== null}
            onClick={() => void handleAccept()}
          >
            {loading === "accept"
              ? "Kaydediliyor…"
              : "İyileştirilmiş hali kullan"}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={loading !== null}
          onClick={() => void handleReject()}
        >
          {loading === "reject" ? "Kaydediliyor…" : "Orijinali kullan"}
        </Button>
      </div>
    </div>
  );
}
