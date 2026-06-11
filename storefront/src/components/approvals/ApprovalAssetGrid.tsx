"use client";

import { cn } from "@/lib/cn";
import type { ApprovalAssetPayload } from "@/lib/approvals/types";

interface ApprovalAssetGridProps {
  assets: ApprovalAssetPayload[];
  onPreview: (url: string, mime: string) => void;
}

export function ApprovalAssetGrid({
  assets,
  onPreview,
}: ApprovalAssetGridProps) {
  if (assets.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {assets.map((asset) => {
        const isPdf = asset.mime === "application/pdf";
        const url = asset.url;
        if (!url) {
          return (
            <div
              key={asset.id}
              className="flex h-24 items-center justify-center rounded-lg border border-gri-200 bg-gri-50 text-xs text-gri-600"
            >
              Önizleme yok
            </div>
          );
        }

        if (isPdf) {
          return (
            <a
              key={asset.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-gri-200 bg-gri-50",
                "text-xs font-semibold text-lacivert hover:bg-gri-100 transition min-h-[44px]"
              )}
            >
              <span className="text-lg">📄</span>
              PDF aç
            </a>
          );
        }

        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onPreview(url, asset.mime)}
            className="group relative h-24 overflow-hidden rounded-lg border border-gri-200 bg-gri-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pim-mercan min-h-[44px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100">
              Büyüt
            </span>
          </button>
        );
      })}
    </div>
  );
}
