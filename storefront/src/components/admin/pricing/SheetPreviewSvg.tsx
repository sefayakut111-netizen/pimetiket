/**
 * SheetPreviewSvg — tek tabaka detay görseli.
 *
 * sticker-fiyatlama.html v0.3 → renderSheet() port'u.
 *
 * Görsel:
 *   - Tabaka modu: zarf (24×32) + iç tabaka (23×31) iç içe
 *   - Die-cut modu: sadece tabaka (büyük tabakada zarf yok)
 *   - Stickerlar grid içinde dolu (mercan) / boş (dashed)
 *   - Alternating dolu/light fill — checkerboard pattern (ilk satırda 1.,3.,5. dolu)
 *   - Sticker boyutu etiketi alt-orta
 *   - Adet/tabaka rozeti
 */

import {
  SMALL_ENVELOPE_W,
  SMALL_ENVELOPE_H,
  type GeometryResult,
} from "@/lib/pricing-engine";
import { computeSheetDistribution } from "./layout-helpers";

interface SheetPreviewSvgProps {
  geometry: GeometryResult;
}

export function SheetPreviewSvg({ geometry }: SheetPreviewSvgProps) {
  const { fit } = geometry;
  const dist = computeSheetDistribution(geometry);

  // Bu önizlemede tek tabakanın görünümü — son tabakadaki adet veya
  // dengeli adet (tek tabaka ise üretilen adet)
  const stickersOnThisSheet =
    fit.sheetsNeeded === 1 ? fit.producedQty : dist.balancedPerSheet;

  const isBigMode = fit.mode === "big";
  const cutW = fit.sheetW;
  const cutH = fit.sheetH;
  const envW = SMALL_ENVELOPE_W;
  const envH = SMALL_ENVELOPE_H;
  const envMargin = isBigMode
    ? 0
    : Math.max(2, Math.min(envW - cutW, envH - cutH) / 2);

  const W = fit.stickerW;
  const H = fit.stickerH;
  const gap = fit.gap;
  const cols = fit.cols;
  const rows = fit.rows;

  const usedWidth = cols * W + (cols - 1) * gap;
  const usedHeight = rows * H + (rows - 1) * gap;
  const offsetX = (cutW - usedWidth) / 2;
  const offsetY = (cutH - usedHeight) / 2;

  // SVG viewport
  const PAD = 30;
  const outerW = isBigMode ? cutW : envW;
  const outerH = isBigMode ? cutH : envH;
  const svgW = outerW + PAD * 2;
  const svgH = outerH + PAD * 2 + 40; // extra for size label

  // Stickers
  const stickers: React.ReactNode[] = [];
  let pos = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = (envMargin + offsetX) + col * (W + gap);
      const sy = (envMargin + offsetY) + row * (H + gap);
      const isFilled = pos < stickersOnThisSheet;
      // Alternating coral intensity for visual variety (matches HTML aesthetic)
      const isAccent = isFilled && (row + col) % 2 === 0;
      stickers.push(
        <rect
          key={pos}
          x={PAD + sx}
          y={PAD + sy}
          width={W}
          height={H}
          rx="2"
          fill={
            isFilled
              ? isAccent
                ? "#FF6B5B"
                : "#FFA89E"
              : "none"
          }
          stroke={isFilled ? "none" : "#C4B091"}
          strokeWidth={isFilled ? 0 : 1}
          strokeDasharray={isFilled ? undefined : "3,2"}
          opacity={isFilled ? 1 : 0.5}
        />
      );
      pos++;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      role="img"
      aria-label={`Tabaka önizleme: ${cutW}×${cutH} mm, ${stickersOnThisSheet}/${fit.perSheet} sticker`}
    >
      {/* Envelope (sadece small mode) */}
      {!isBigMode && (
        <rect
          x={PAD}
          y={PAD}
          width={envW}
          height={envH}
          fill="#F5EBD9"
          stroke="#C4B091"
          strokeWidth="1.5"
          strokeDasharray="4,3"
          rx="6"
        />
      )}

      {/* Cut sheet (içte) */}
      <rect
        x={PAD + envMargin}
        y={PAD + envMargin}
        width={cutW}
        height={cutH}
        fill="white"
        stroke="#1F2937"
        strokeWidth="2"
        rx="3"
      />

      {/* Stickers */}
      {stickers}

      {/* Size label */}
      <text
        x={svgW / 2}
        y={svgH - 8}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="11"
        fill="#4B5563"
        fontWeight="600"
      >
        {cutW}×{cutH}mm
        {!isBigMode && ` · zarf ${envW}×${envH}mm`}
      </text>
    </svg>
  );
}
