/**
 * SheetPreviewSvg — tek tabaka detay görseli.
 *
 * sticker-fiyatlama.html v0.3 → renderSheet() port'u.
 *
 * Görsel:
 *   - Tabaka küçük zarfa sığıyorsa: zarf + iç tabaka iç içe
 *   - Tabaka zarftan büyükse (33×45 cm): yalnızca tabaka (viewBox tabakaya göre)
 *   - Die-cut / büyük mod: zarf yok
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

  const stickersOnThisSheet =
    fit.sheetsNeeded === 1 ? fit.producedQty : dist.balancedPerSheet;

  const isBigMode = fit.mode === "big";
  const cutW = fit.sheetW;
  const cutH = fit.sheetH;
  const envW = SMALL_ENVELOPE_W;
  const envH = SMALL_ENVELOPE_H;

  /** 33×45 tabaka artık 24×32 zarftan büyük — zarf yalnızca sığıyorsa çizilir */
  const showEnvelope =
    !isBigMode && cutW <= envW && cutH <= envH;

  const sheetInsetX = showEnvelope
    ? Math.max(2, (envW - cutW) / 2)
    : 0;
  const sheetInsetY = showEnvelope
    ? Math.max(2, (envH - cutH) / 2)
    : 0;

  const outerW = showEnvelope ? envW : cutW;
  const outerH = showEnvelope ? envH : cutH;

  const W = fit.stickerW;
  const H = fit.stickerH;
  const gap = fit.gap;
  const cols = fit.cols;
  const rows = fit.rows;

  const usedWidth = cols * W + (cols - 1) * gap;
  const usedHeight = rows * H + (rows - 1) * gap;
  const gridOffsetX = (cutW - usedWidth) / 2;
  const gridOffsetY = (cutH - usedHeight) / 2;

  const PAD = 16;
  const LABEL_H = 22;
  const svgW = outerW + PAD * 2;
  const svgH = outerH + PAD * 2 + LABEL_H;

  const sheetX = PAD + sheetInsetX;
  const sheetY = PAD + sheetInsetY;

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
          fill={
            isFilled ? (isAccent ? "#FF6B5B" : "#FFA89E") : "none"
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

  const labelY = PAD + outerH + LABEL_H - 6;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-h-[340px]"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Tabaka önizleme: ${cutW}×${cutH} mm, ${stickersOnThisSheet}/${fit.perSheet} sticker`}
    >
      {showEnvelope && (
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
        fontSize="11"
        fill="#4B5563"
        fontWeight="600"
      >
        {cutW}×{cutH}mm
        {showEnvelope ? ` · zarf ${envW}×${envH}mm` : ""}
      </text>
    </svg>
  );
}
