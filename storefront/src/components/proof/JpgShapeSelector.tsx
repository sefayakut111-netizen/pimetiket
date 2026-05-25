"use client";

import type { ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

export type GeoShape = "square" | "circle" | "oval" | "rounded_rect";

const DEFAULT_OFFSET_MM = 1.5;
const DEFAULT_CORNER_RADIUS_MM = 2;

export function generateGeoSvgPath(
  shape: GeoShape,
  width: number,
  height: number,
  offset: number = DEFAULT_OFFSET_MM,
  cornerRadius: number = DEFAULT_CORNER_RADIUS_MM
): string {
  const w = width + offset * 2;
  const h = height + offset * 2;

  switch (shape) {
    case "square":
      return `M 0 0 H ${w} V ${h} H 0 Z`;
    case "circle": {
      const r = Math.max(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
    }
    case "oval": {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${rx} ${h} A ${rx} ${ry} 0 1 1 ${rx} 0 Z`;
    }
    case "rounded_rect": {
      const cr = Math.min(cornerRadius, w / 4, h / 4);
      return `M ${cr} 0 H ${w - cr} Q ${w} 0 ${w} ${cr} V ${h - cr} Q ${w} ${h} ${w - cr} ${h} H ${cr} Q 0 ${h} 0 ${h - cr} V ${cr} Q 0 0 ${cr} 0 Z`;
    }
  }
}

export function buildGeoCutlineSvg(
  shape: GeoShape,
  widthMm: number,
  heightMm: number,
  offsetMm = DEFAULT_OFFSET_MM,
  cornerRadiusMm = DEFAULT_CORNER_RADIUS_MM
): string {
  const path = generateGeoSvgPath(
    shape,
    widthMm,
    heightMm,
    offsetMm,
    cornerRadiusMm
  );
  const w = widthMm + offsetMm * 2;
  const h = heightMm + offsetMm * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm"><path fill="none" stroke="#FF0000" stroke-width="0.25" d="${path}"/></svg>`;
}

export function geoShapeToSaveMode(
  shape: GeoShape
): "contour" | "rect" | "circle" {
  switch (shape) {
    case "square":
    case "rounded_rect":
      return "rect";
    case "circle":
      return "circle";
    case "oval":
      return "contour";
  }
}

const SHAPES: Array<{
  id: GeoShape;
  label: string;
  icon: ReactNode;
}> = [
  { id: "square", label: "Kare", icon: <span className="text-xl">□</span> },
  { id: "circle", label: "Daire", icon: <span className="text-xl">○</span> },
  { id: "oval", label: "Oval", icon: <span className="text-xl">⬭</span> },
  {
    id: "rounded_rect",
    label: "Yuvarlak köşe",
    icon: <span className="text-xl">▢</span>,
  },
];

export interface JpgShapeSelectorProps {
  orderId: string;
  itemId: string;
  designWidth: number;
  designHeight: number;
  material: string;
  onShapeSelected: (shape: GeoShape) => void | Promise<void>;
  onUploadPng: () => void;
  onRequestHelp: () => void;
  saving?: boolean;
}

export function JpgShapeSelector({
  designWidth,
  designHeight,
  onShapeSelected,
  onUploadPng,
  onRequestHelp,
  saving = false,
}: JpgShapeSelectorProps) {
  return (
    <Card className="mx-auto max-w-lg border-sari-soft/60 bg-white p-6">
      <div className="mb-4 flex items-start gap-2 text-sari-koyu">
        <Icon.Info size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-lacivert">
            JPG dosyanda arka plan bilgisi yok
          </p>
          <p className="mt-1 text-sm text-gri-700">
            Bıçak çizimi için aşağıdaki seçeneklerden birini seç (
            {designWidth}×{designHeight} mm).
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={onUploadPng}
        disabled={saving}
      >
        <Icon.Plus size={16} />
        Şeffaf PNG yükle
      </Button>
      <p className="mt-1 text-center text-xs text-gri-700">
        En iyi sonuç için önerilen
      </p>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gri-200" />
        <span className="text-xs font-medium text-gri-700">
          veya hazır şekil seç
        </span>
        <div className="h-px flex-1 bg-gri-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={saving}
            onClick={() => void onShapeSelected(s.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-gri-200 bg-gri-50 p-4 transition",
              "hover:border-pim-mercan hover:bg-pim-mercan-tint/30",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {s.icon}
            <span className="text-xs font-medium text-lacivert">{s.label}</span>
          </button>
        ))}
      </div>

      {saving && (
        <p className="mt-4 text-center text-sm text-gri-700">
          Bıçak çizgisi kaydediliyor…
        </p>
      )}

      <button
        type="button"
        onClick={onRequestHelp}
        disabled={saving}
        className="mt-5 w-full text-center text-sm font-medium text-pim-mercan hover:underline disabled:opacity-50"
      >
        Operatör desteği iste
      </button>
      <p className="mt-1 text-center text-xs text-gri-700">
        Özel kontur gerekiyorsa
      </p>
    </Card>
  );
}
