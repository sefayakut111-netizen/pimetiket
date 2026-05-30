"use client";

import { cn } from "@/lib/cn";

export type EditorLayer = "cut" | "white" | "bleed" | "safe";

interface EditorPreviewToolbarProps {
  zoom: number;
  layers: Record<EditorLayer, boolean>;
  widthMm: number;
  heightMm: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleLayer: (layer: EditorLayer, on: boolean) => void;
}

const LAYER_LABELS: { id: EditorLayer; label: string }[] = [
  { id: "cut", label: "Bıçak" },
  { id: "bleed", label: "Bleed" },
  { id: "safe", label: "Safe" },
  { id: "white", label: "Beyaz" },
];

export function EditorPreviewToolbar({
  zoom,
  layers,
  widthMm,
  heightMm,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleLayer,
}: EditorPreviewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gri-200 px-3 py-2.5 bg-white rounded-t-xl">
      <div
        className="text-[12px] font-semibold text-gri-700 tabular-nums"
        aria-live="polite"
      >
        {widthMm}×{heightMm} mm
      </div>

      <div
        className="flex items-center gap-1"
        role="toolbar"
        aria-label="Zoom kontrolleri"
      >
        <button
          type="button"
          onClick={onZoomOut}
          className="h-8 w-8 rounded-lg border border-gri-200 text-[16px] font-medium hover:bg-gri-50"
          aria-label="Uzaklaştır"
        >
          −
        </button>
        <span className="min-w-[44px] text-center text-[12px] font-semibold tabular-nums text-gri-700">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          className="h-8 w-8 rounded-lg border border-gri-200 text-[16px] font-medium hover:bg-gri-50"
          aria-label="Yakınlaştır"
        >
          +
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          className="h-8 px-2 rounded-lg border border-gri-200 text-[11px] font-semibold hover:bg-gri-50"
        >
          Sıfırla
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LAYER_LABELS.map(({ id, label }) => {
          const on = layers[id];
          return (
            <button
              key={id}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${label} katmanı`}
              onClick={() => onToggleLayer(id, !on)}
              className={cn(
                "h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors",
                on
                  ? "bg-pim-mercan-tint text-pim-mercan ring-1 ring-pim-mercan/30"
                  : "bg-gri-100 text-gri-600"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
