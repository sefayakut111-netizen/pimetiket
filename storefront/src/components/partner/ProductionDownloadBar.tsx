"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type ProductionExportType =
  | "design"
  | "cutline"
  | "composite"
  | "pdf";

const EXPORT_LABELS: Record<ProductionExportType, string> = {
  design: "Görüntü",
  cutline: "Bıçak",
  composite: "Görüntü + Bıçak",
  pdf: "Print-ready PDF",
};

const EXPORT_ICONS: Record<ProductionExportType, string> = {
  design: "🖼",
  cutline: "✂️",
  composite: "📦",
  pdf: "📄",
};

export async function downloadProductionExport(
  orderId: string,
  itemId: string,
  type: ProductionExportType,
  designFileId?: string
): Promise<void> {
  const qs = new URLSearchParams({ type });
  if (designFileId) qs.set("design_file_id", designFileId);
  const res = await fetch(
    `/api/orders/${orderId}/proof/${itemId}/production-export?${qs.toString()}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const ext =
    type === "cutline"
      ? "svg"
      : type === "composite"
        ? "png"
        : type === "pdf"
          ? "pdf"
          : "bin";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pim-${type}-${orderId.slice(-6)}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface ProductionDownloadBarProps {
  orderId: string;
  itemId: string;
  designFileId?: string | null;
  hasCutline?: boolean;
  compact?: boolean;
  className?: string;
  onError?: (message: string) => void;
}

export function ProductionDownloadBar({
  orderId,
  itemId,
  designFileId,
  hasCutline = true,
  compact = false,
  className,
  onError,
}: ProductionDownloadBarProps) {
  const [loading, setLoading] = useState<ProductionExportType | null>(null);

  const types: ProductionExportType[] = hasCutline
    ? ["design", "cutline", "composite", "pdf"]
    : ["design"];

  const handleDownload = async (type: ProductionExportType) => {
    setLoading(type);
    try {
      await downloadProductionExport(
        orderId,
        itemId,
        type,
        designFileId ?? undefined
      );
    } catch {
      onError?.("İndirme başarısız — dosya hazır olmayabilir.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {!compact && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-gri-700">
          Üretim dosyaları
        </p>
      )}
      <div
        className={cn(
          "flex gap-2",
          compact ? "flex-wrap" : "flex-col sm:flex-row sm:flex-wrap"
        )}
      >
        {types.map((type) => (
          <button
            key={type}
            type="button"
            disabled={loading !== null}
            onClick={() => void handleDownload(type)}
            className={cn(
              "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition-colors",
              "border-gri-200 bg-white text-lacivert hover:border-pim-mercan hover:bg-pim-mercan-tint/40",
              "disabled:cursor-wait disabled:opacity-60",
              compact && "min-h-[44px] flex-none px-3 py-2 text-[11.5px]"
            )}
          >
            <span aria-hidden>{EXPORT_ICONS[type]}</span>
            {loading === type ? "İndiriliyor…" : EXPORT_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
