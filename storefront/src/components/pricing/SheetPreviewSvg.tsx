/**
 * SheetPreviewSvg — tek tabaka detay görseli (esnek iç tabaka).
 *
 * Die-cut modunda iç tabaka yok — bu SVG yalnızca tabaka akışında anlamlı.
 */

import type { GeometryResult } from "@/lib/pricing-engine";
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

  const usedWidth = cols * W + (cols - 1) * gap;
  const usedHeight = rows * H + (rows - 1) * gap;
  const gridOffsetX = (cutW - usedWidth) / 2;
  const gridOffsetY = (cutH - usedHeight) / 2;

  const PAD = 20;
  const LABEL_H = 32;
  const dimFontSize = Math.max(20, cutW * 0.055);
  const svgW = cutW + PAD * 2;
  const svgH = cutH + PAD * 2 + LABEL_H;

  const sheetX = PAD;
  const sheetY = PAD;

  const stickers: React.ReactNode[] = [];
  let pos = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = sheetX + gridOffsetX + col * (W + gap);
      const sy = sheetY + gridOffsetY + row * (H + gap);
      const isFilled = pos < stickersOnThisSheet;
      const isAccent = isFilled && (row + col) % 2 === 0;
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

  const labelY = PAD + cutH + LABEL_H - 6;

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

      {stickers}

      <text
        x={svgW / 2}
        y={labelY}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={dimFontSize}
        fill="#1F2937"
        fontWeight="700"
      >
        {cutW}×{cutH}mm · kullanılabilir {fit.usedW}×{fit.usedH}mm
      </text>
    </svg>
  );
}
