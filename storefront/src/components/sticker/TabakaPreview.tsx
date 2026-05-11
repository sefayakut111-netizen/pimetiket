"use client";

/**
 * Pim Etiket — Sticker tabaka önizlemesi (Sefa Madde 10, 11 May)
 *
 * "Stickerda tabaka kısmında önizleme tabaka üzerinde olacak."
 *
 * Tabaka çerçevesi + sticker grid'i SVG ile gösterilir. Mevcut
 * geometry.ts `computeGeometry` cols/rows/perSheet hesaplıyor —
 * bu component onun çıktısını görselleştirir.
 *
 * Sadece tabaka modu için anlamlı (die-cut'ta tabaka yok).
 */

import { useMemo } from "react";
import { computeGeometry } from "@/lib/pricing-engine/geometry";

interface Props {
  width: number;
  height: number;
  cut: "tabaka" | "diecut";
  qty: number;
}

const FRAME_W = 320; // SVG container genişliği (px)
const FRAME_H = 220;

export function TabakaPreview({ width, height, cut, qty }: Props) {
  const geo = useMemo(
    () => computeGeometry({ width, height, cut, qty }),
    [width, height, cut, qty]
  );

  if (!geo || geo.effectiveCut !== "tabaka") {
    return (
      <div className="rounded-xl bg-gri-50 ring-1 ring-gri-200 p-4 text-[12.5px] text-gri-700">
        Tabaka modunda önizleme oluşturulamadı.
      </div>
    );
  }

  // Tabaka boyutu (real mm) → SVG koordinat sistemi (auto-scale)
  const { fit } = geo;
  const {
    sheetW,
    sheetH,
    cols,
    rows,
    perSheet,
    stickerW,
    stickerH,
    gap,
    sheetsNeeded,
    producedQty,
  } = fit;
  // SVG'de tabaka boyutu için tek bir ölçek faktörü hesapla
  const scaleX = FRAME_W / sheetW;
  const scaleY = FRAME_H / sheetH;
  const scale = Math.min(scaleX, scaleY) * 0.92; // %8 padding
  const renderW = sheetW * scale;
  const renderH = sheetH * scale;
  const offsetX = (FRAME_W - renderW) / 2;
  const offsetY = (FRAME_H - renderH) / 2;

  const stickerRenderW = stickerW * scale;
  const stickerRenderH = stickerH * scale;
  const gapRender = gap * scale;

  // Tabaka içinde sticker'ları yerleştir — kullanılan alan ortalanır
  const usedW = cols * stickerW + (cols - 1) * gap;
  const usedH = rows * stickerH + (rows - 1) * gap;
  const startX = offsetX + (renderW - usedW * scale) / 2;
  const startY = offsetY + (renderH - usedH * scale) / 2;

  const stickers: Array<{ x: number; y: number; idx: number }> = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      stickers.push({
        x: startX + c * (stickerRenderW + gapRender),
        y: startY + r * (stickerRenderH + gapRender),
        idx: ++idx,
      });
    }
  }

  return (
    <div className="rounded-xl bg-gri-50 ring-1 ring-gri-200 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[12.5px] text-gri-700">
          Tabaka{" "}
          <strong className="text-lacivert tabular-nums">
            {sheetW}×{sheetH} mm
          </strong>{" "}
          ·{" "}
          <strong className="text-lacivert tabular-nums">
            {cols}×{rows}
          </strong>{" "}
          ={" "}
          <strong className="text-pim-mercan tabular-nums">
            {perSheet}
          </strong>{" "}
          sticker / tabaka
        </div>
        <div className="text-[11.5px] text-gri-700 tabular-nums">
          {sheetsNeeded} tabaka × {perSheet} ={" "}
          <strong className="text-lacivert">{producedQty}</strong>{" "}
          adet
        </div>
      </div>

      <div
        className="bg-white rounded-lg ring-1 ring-gri-200 mx-auto"
        style={{ width: FRAME_W, height: FRAME_H }}
      >
        <svg
          width={FRAME_W}
          height={FRAME_H}
          viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
          role="img"
          aria-label={`Tabaka önizleme: ${sheetW} × ${sheetH} mm, ${cols} × ${rows} grid, ${perSheet} sticker`}
        >
          {/* Tabaka çerçevesi */}
          <rect
            x={offsetX}
            y={offsetY}
            width={renderW}
            height={renderH}
            fill="#FAFAF8"
            stroke="#9B9789"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            rx={4}
          />

          {/* Sticker'lar */}
          {stickers.map((s) => (
            <rect
              key={s.idx}
              x={s.x}
              y={s.y}
              width={stickerRenderW}
              height={stickerRenderH}
              fill="rgba(255, 107, 91, 0.18)"
              stroke="#FF6B5B"
              strokeWidth={1}
              rx={Math.min(stickerRenderW, stickerRenderH) * 0.08}
            />
          ))}

          {/* Köşe etiketi: tabaka boyutu */}
          <text
            x={offsetX + 4}
            y={offsetY - 4}
            fontSize="9"
            fill="#9B9789"
            fontFamily="ui-sans-serif, system-ui"
          >
            {sheetW}×{sheetH} mm
          </text>
        </svg>
      </div>

      <p className="text-[11px] text-gri-700 mt-3 leading-relaxed text-center">
        Her tabakada {perSheet} sticker bulunur. Toplam{" "}
        {sheetsNeeded} tabaka basılır.
      </p>
    </div>
  );
}
