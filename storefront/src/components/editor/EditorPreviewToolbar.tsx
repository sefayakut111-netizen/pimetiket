"use client";

import { cn } from "@/lib/cn";

export type EditorLayer = "cut" | "white" | "bleed" | "safe";

export const LAYER_LABELS: { id: EditorLayer; label: string }[] = [
  { id: "cut", label: "Bıçak" },
  { id: "bleed", label: "Bleed" },
  { id: "safe", label: "Safe" },
  { id: "white", label: "Beyaz" },
];

interface EditorZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function EditorZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: EditorZoomControlsProps) {
  return (
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
      <span className="min-w-[52px] text-center text-[12px] font-semibold tabular-nums text-gri-700">
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
  );
}

interface EditorLayerTogglesProps {
  layers: Record<EditorLayer, boolean>;
  onToggleLayer: (layer: EditorLayer, on: boolean) => void;
}

export function EditorLayerToggles({
  layers,
  onToggleLayer,
}: EditorLayerTogglesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {LAYER_LABELS.map(({ id, label }) => {
        const on = layers[id];
        return (
          <button
            key={id}
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${label} katmanı`}
            title={on ? `${label} açık` : `${label} kapalı`}
            onClick={() => onToggleLayer(id, !on)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 px-3 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors",
              on
                ? "bg-pim-mercan-tint text-pim-mercan ring-1 ring-pim-mercan"
                : "bg-white text-gri-500 ring-1 ring-gri-200"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                on ? "bg-pim-mercan" : "bg-gri-300"
              )}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
