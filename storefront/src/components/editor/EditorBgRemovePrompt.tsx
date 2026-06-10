"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export interface BgRemovePreviewPayload {
  beforeDataUrl: string;
  afterDataUrl: string;
  fileName: string;
}

interface EditorBgRemovePromptProps {
  preview: BgRemovePreviewPayload;
  onAccept: () => void;
  onReject: () => void;
}

export function EditorBgRemovePrompt({
  preview,
  onAccept,
  onReject,
}: EditorBgRemovePromptProps) {
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  return (
    <div className="rounded-xl border border-gri-200 bg-white p-3 shadow-sm">
      <p className="text-[13px] font-semibold text-lacivert">
        Arka plan kaldırıldı — sonucu onayla
      </p>
      <p className="mt-1 text-[12px] text-gri-600 leading-snug">
        Beğenmezsen orijinale geri döneriz.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[10px] font-medium text-gri-500">Önce</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.beforeDataUrl}
            alt="Orijinal görsel"
            className="h-24 w-full rounded-lg border border-gri-200 object-contain bg-gri-50"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium text-gri-500">Sonra</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.afterDataUrl}
            alt="Arka planı kaldırılmış görsel"
            className="h-24 w-full rounded-lg border border-gri-200 object-contain bg-gri-50"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!!busy}
          onClick={() => {
            setBusy("accept");
            onAccept();
          }}
        >
          {busy === "accept" ? "Uygulanıyor…" : "Kabul et"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!!busy}
          onClick={() => {
            setBusy("reject");
            onReject();
          }}
        >
          Orijinale dön
        </Button>
      </div>
    </div>
  );
}
