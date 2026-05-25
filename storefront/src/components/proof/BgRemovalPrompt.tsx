"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { BgDetectResult } from "@/lib/proof/background-detect";

interface BgRemovalPromptProps {
  orderId: string;
  itemId: string;
  designFileId: string | null;
  bgDetect: BgDetectResult;
  previewUrl?: string | null;
  onDismiss: () => void;
  onRemoved: () => void;
}

export function BgRemovalPrompt({
  orderId,
  itemId,
  designFileId,
  bgDetect,
  previewUrl,
  onDismiss,
  onRemoved,
}: BgRemovalPromptProps) {
  const [loading, setLoading] = useState<"remove" | "dismiss" | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setLoading("remove");
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/${orderId}/proof/${itemId}/background/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designFileId }),
        }
      );
      const j = (await res.json()) as {
        ok?: boolean;
        previewUrl?: string;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setError(j.error ?? "Arka plan kaldırılamadı");
        return;
      }
      if (j.previewUrl) setPreviewAfter(j.previewUrl);
      onRemoved();
    } catch {
      setError("Bağlantı hatası — tekrar dene");
    } finally {
      setLoading(null);
    }
  };

  const handleDismiss = async () => {
    setLoading("dismiss");
    setError(null);
    try {
      await fetch(`/api/orders/${orderId}/proof/${itemId}/background/dismiss`, {
        method: "POST",
      });
      onDismiss();
    } finally {
      setLoading(null);
    }
  };

  const bgLabel =
    bgDetect.bgType === "solid_white"
      ? "beyaz arka plan"
      : "arka plan";

  return (
    <div className="rounded-xl border-2 border-sari-koyu/30 bg-sari-soft/20 p-4">
      <p className="text-sm font-semibold text-lacivert">
        ⚠️ {bgLabel.charAt(0).toUpperCase() + bgLabel.slice(1)} tespit ettik
      </p>
      <p className="mt-2 text-sm text-gri-700">
        Şeffaf sticker sipariş ettin ama tasarımında {bgLabel} var. Bu durumda
        sticker beyaz kare olabilir.
        {bgDetect.bgCoverage != null && (
          <span className="block mt-1 text-xs text-gri-500">
            Arka plan yaklaşık %{Math.round(bgDetect.bgCoverage)} alan kaplıyor.
          </span>
        )}
      </p>

      {(previewUrl || previewAfter) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-gri-700">Öncesi</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? undefined}
              alt="Orijinal"
              className="max-h-32 w-full rounded border border-gri-200 object-contain bg-white"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gri-700">Sonrası</p>
            {previewAfter ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewAfter}
                alt="Arka plansız"
                className="max-h-32 w-full rounded border border-gri-200 object-contain"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%)",
                  backgroundSize: "12px 12px",
                }}
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded border border-dashed border-gri-300 text-xs text-gri-500">
                Kaldırınca önizleme
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-kirmizi">{error}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={loading !== null}
          onClick={() => void handleRemove()}
        >
          {loading === "remove" ? "Kaldırılıyor…" : "✅ Arka planı kaldır"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={loading !== null}
          onClick={() => void handleDismiss()}
        >
          {loading === "dismiss" ? "Kaydediliyor…" : "⏭️ Bu şekilde devam et"}
        </Button>
      </div>
    </div>
  );
}
