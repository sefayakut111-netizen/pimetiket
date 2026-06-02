/**
 * SheetPreviewSvg — tek tabaka detay görseli (esnek iç tabaka).
 *
 * Die-cut modunda iç tabaka yok — bu SVG yalnızca tabaka akışında anlamlı.
 */

import type { GeometryResult } from "@/lib/pricing-engine";
import { TABAKA_EDGE_MARGIN } from "@/lib/pricing-engine";
import { computeSheetDistribution } from "./layout-helpers";

interface SheetPreviewSvgProps {
  geometry: GeometryResult;
}

export function SheetPreviewSvg({ geometry }: SheetPreviewSvgProps) {
  const { fit } = geometry;
  const dist = computeSheetDistribution(geometry);

  const stickersOnThisSheet =
    fit.sheetsNeeded === 1 ? fit.producedQty : dist.balancedPerSheet;

  const cutW = fit.sheetW;
  const cutH = fit.sheetH;

  const W = fit.stickerW;
  const H = fit.stickerH;
  const gap = fit.gap;
  const cols = fit.cols;
  const rows = fit.rows;
  const edge = TABAKA_EDGE_MARGIN;

  const usedWidth = cols * W + (cols - 1) * gap;
  const usedHeight = rows * H + (rows - 1) * gap;
  const gridOffsetX = edge;
  const gridOffsetY = edge;

  const PAD = 24;
  const LABEL_H = 48;
  const labelLine1 = `${cutW}×${cutH}mm`;
  const labelLine2 = `kullanılabilir ${fit.usedW}×${fit.usedH}mm`;
  const dimFontSize = Math.min(
    18,
    Math.max(12, ((cutW + PAD * 2) * 0.9) / Math.max(labelLine1.length, labelLine2.length + 2))
  );
  const svgW = cutW + PAD * 2;
  const svgH = cutH + PAD * 2 + LABEL_H;

  const sheetX = PAD;
  const sheetY = PAD;

  const stickers: React.ReactNode[] = [];
  const gapMarkers: React.ReactNode[] = [];
  let pos = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = sheetX + gridOffsetX + col * (W + gap);
      const sy = sheetY + gridOffsetY + row * (H + gap);
      const isFilled = pos < stickersOnThisSheet;
      const isAccent = isFilled && (row + col) % 2 === 0;

      if (col > 0) {
        gapMarkers.push(
          <rect
            key={`gx-${row}-${col}`}
            x={sx - gap}
            y={sy}
            width={gap}
            height={H}
            fill="#E8E0D0"
            opacity={0.85}
          />
        );
      }
      if (row > 0) {
        gapMarkers.push(
          <rect
            key={`gy-${row}-${col}`}
            x={sx}
            y={sy - gap}
            width={W}
            height={gap}
            fill="#E8E0D0"
            opacity={0.85}
          />
        );
      }

      stickers.push(
        <rect
          key={pos}
          x={sx}
          y={sy}
          width={W}
          height={H}
          rx="2"
          fill={isFilled ? (isAccent ? "#FF6B5B" : "#FFA89E") : "none"}
          stroke={isFilled ? "none" : "#C4B091"}
          strokeWidth={isFilled ? 0 : 1}
          strokeDasharray={isFilled ? undefined : "3,2"}
          opacity={isFilled ? 1 : 0.5}
        />
      );
      pos++;
    }
  }

  const labelY1 = PAD + cutH + 18;
  const labelY2 = labelY1 + dimFontSize + 4;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-h-[340px] min-h-[200px]"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Tabaka önizleme: ${cutW}×${cutH} mm, ${stickersOnThisSheet}/${fit.perSheet} sticker`}
    >
      <rect
        x={sheetX}
        y={sheetY}
        width={cutW}
        height={cutH}
        fill="white"
        stroke="#1F2937"
        strokeWidth="2"
        rx="3"
      />

      {/* 1 cm kenar boşluğu şeritleri */}
      <rect
        x={sheetX}
        y={sheetY}
        width={cutW}
        height={edge}
        fill="#F5EBD9"
        opacity={0.7}
      />
      <rect
        x={sheetX}
        y={sheetY + cutH - edge}
        width={cutW}
        height={edge}
        fill="#F5EBD9"
        opacity={0.7}
      />
      <rect
        x={sheetX}
        y={sheetY + edge}
        width={edge}
        height={cutH - 2 * edge}
        fill="#F5EBD9"
        opacity={0.7}
      />
      <rect
        x={sheetX + cutW - edge}
        y={sheetY + edge}
        width={edge}
        height={cutH - 2 * edge}
        fill="#F5EBD9"
        opacity={0.7}
      />

      {/* Kullanılabilir alan */}
      <rect
        x={sheetX + edge}
        y={sheetY + edge}
        width={usedWidth}
        height={usedHeight}
        fill="none"
        stroke="#C4B091"
        strokeWidth="1"
        strokeDasharray="4,3"
        opacity={0.8}
      />

      {gapMarkers}
      {stickers}

      <text
        x={svgW / 2}
        y={labelY1}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={dimFontSize}
        fill="#1F2937"
        fontWeight="700"
      >
        {labelLine1}
      </text>
      <text
        x={svgW / 2}
        y={labelY2}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={dimFontSize}
        fill="#4B5563"
        fontWeight="600"
      >
        {labelLine2}
      </text>
    </svg>
  );
}
