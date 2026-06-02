/**
 * RollPlanSvg — büyük plotter rulosu üstündeki tabaka dizgisi.
 *
 * sticker-fiyatlama.html v0.3 → renderRollPlan() port'u.
 *
 * Görsel:
 *   - Yatay rulo (X = boy 1520mm, Y = en dinamik 250-600mm)
 *   - Üst+alt 30mm kesim markası (mercan dotted pattern)
 *   - Sol 30mm plotter başlangıcı (sarı stripe pattern)
 *   - Sağ 80mm plotter bitişi (cream zigzag)
 *   - Tabakalar grid içinde, dolu = "X adet", boş = dashed
 *   - Son rulonun sağ kısmında fire (cream zigzag)
 *   - Min eni dayandığında ekstra hava (üst+alt cream zigzag)
 *   - Üst rulo kapağında "1520 mm BOY" etiketi
 *   - Sağda "rollW mm EN" etiketi + tasarruf bilgisi
 *   - 3 ruloya kadar göster, daha çoksa "+ N rulo daha" özet
 */

import {
  ROLL_L,
  ROLL_END_MARGIN,
  ROLL_MARGIN_X,
  ROLL_START_MARGIN,
  ROLL_W_MAX,
  type GeometryResult,
} from "@/lib/pricing-engine";
import { computeSheetDistribution } from "./layout-helpers";

interface RollPlanSvgProps {
  geometry: GeometryResult;
  /** Maximum kaç rulo göstereceğiz (geri kalan özet) */
  maxRollsToShow?: number;
}

export function RollPlanSvg({
  geometry,
  maxRollsToShow = 3,
}: RollPlanSvgProps) {
  const { fit, roll } = geometry;
  const dist = computeSheetDistribution(geometry);

  const rollW = roll.rollW;
  const usedW = roll.cols * fit.sheetW;
  const sidePad = (rollW - usedW) / 2;

  const SHEET_X = fit.sheetH;
  const SHEET_Y = fit.sheetW;

  const rollsToShow = Math.min(roll.rollsNeeded, maxRollsToShow);
  const showSummary = roll.rollsNeeded > maxRollsToShow;

  const PAD_X = 80;
  const PAD_TOP = 45;
  const PAD_BOTTOM = 30;
  const ROLL_GAP = 60;

  const getRollHeight = (rollI: number) =>
    rollI === roll.rollsNeeded - 1 ? roll.lastRollW : rollW;

  let cumulativeY = PAD_TOP;
  const rollHeights: number[] = [];
  const rolls: React.ReactNode[] = [];
  for (let rollI = 0; rollI < rollsToShow; rollI++) {
    const effectiveRollW = getRollHeight(rollI);
    rollHeights.push(effectiveRollW);
    const isActualLastRoll = rollI === roll.rollsNeeded - 1;
    rolls.push(
      <RollGroup
        key={rollI}
        rollI={rollI}
        rollY={cumulativeY}
        rollW={rollW}
        effectiveRollW={effectiveRollW}
        sidePad={sidePad}
        usedCols={isActualLastRoll ? roll.lastRollUsedCols : roll.cols}
        usedRows={isActualLastRoll ? roll.lastRollUsedRows : roll.rows}
        hideEmptySlots={isActualLastRoll && roll.sheetsOnLastRoll < roll.sheetsPerRoll}
        sheetX={SHEET_X}
        sheetY={SHEET_Y}
        cols={roll.cols}
        rows={roll.rows}
        sheetsPerRoll={roll.sheetsPerRoll}
        sheetsOnLastRoll={roll.sheetsOnLastRoll}
        rollsNeeded={roll.rollsNeeded}
        balancedPerSheet={dist.balancedPerSheet}
        lastSheetCount={dist.lastSheetCount}
        sheetW={fit.sheetW}
        sheetH={fit.sheetH}
        stickerGrid={`${fit.cols}×${fit.rows}`}
        padX={PAD_X}
      />
    );
    cumulativeY += effectiveRollW + ROLL_GAP;
  }

  const totalSvgWidth = ROLL_L + PAD_X * 2;
  const totalSvgHeight =
    cumulativeY - ROLL_GAP + PAD_BOTTOM + (showSummary ? 40 : 0);

  const topLabel = (
    <g transform={`translate(${PAD_X}, ${PAD_TOP - 16})`}>
      <line
        x1="0"
        y1="0"
        x2={ROLL_L}
        y2="0"
        stroke="#9CA3AF"
        strokeWidth="1.2"
      />
      <line x1="0" y1="-7" x2="0" y2="7" stroke="#9CA3AF" strokeWidth="1.2" />
      <line
        x1={ROLL_L}
        y1="-7"
        x2={ROLL_L}
        y2="7"
        stroke="#9CA3AF"
        strokeWidth="1.2"
      />
      <rect
        x={ROLL_L / 2 - 80}
        y="-12"
        width="160"
        height="22"
        fill="#FCFAF5"
      />
      <text
        x={ROLL_L / 2}
        y="4"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="22"
        fill="#1F2937"
        fontWeight="700"
      >
        1520 mm BOY
      </text>
    </g>
  );

  const rightLabel = (
    <g transform={`translate(${PAD_X + ROLL_L + 24}, ${PAD_TOP + rollHeights[0]! / 2})`}>
      <text
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="22"
        fill="#1F2937"
        fontWeight="700"
        transform="rotate(90)"
      >
        {rollW} mm EN
      </text>
      {rollW < ROLL_W_MAX && (
        <text
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="22"
          fill="#10B981"
          fontWeight="600"
          transform={`rotate(90) translate(0, 20)`}
        >
          ({ROLL_W_MAX - rollW}mm tasarruf)
        </text>
      )}
    </g>
  );

  const summaryRow = showSummary ? (
    <g>
      <rect
        x={PAD_X}
        y={PAD_TOP + rollHeights.reduce((a, h) => a + h + ROLL_GAP, 0) - ROLL_GAP}
        width={ROLL_L}
        height="32"
        fill="#F5EBD9"
        stroke="#C4B091"
        strokeWidth="1"
        strokeDasharray="4,3"
        rx="4"
      />
      <text
        x={PAD_X + ROLL_L / 2}
        y={PAD_TOP + rollHeights.reduce((a, h) => a + h + ROLL_GAP, 0) - ROLL_GAP + 21}
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="22"
        fill="#1F2937"
        fontWeight="600"
      >
        + {roll.rollsNeeded - maxRollsToShow} rulo daha (toplam{" "}
        {roll.rollsNeeded} rulo)
      </text>
    </g>
  ) : null;

  return (
    <svg
      viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[1100px] h-auto"
      role="img"
      aria-label={`Rulo plan görseli: ${roll.rollsNeeded} rulo, ${fit.sheetsNeeded} tabaka`}
    >
      <defs>
        <pattern
          id="fire-pat"
          patternUnits="userSpaceOnUse"
          width="10"
          height="10"
          patternTransform="rotate(45)"
        >
          <rect width="10" height="10" fill="#F5EBD9" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="#D8C9AC" strokeWidth="2.5" />
        </pattern>
        <pattern
          id="cut-mark-pat"
          patternUnits="userSpaceOnUse"
          width="20"
          height="20"
        >
          <rect width="20" height="20" fill="#FEF3F2" />
          <line
            x1="0"
            y1="10"
            x2="20"
            y2="10"
            stroke="#FF6B5B"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <circle cx="10" cy="10" r="1.5" fill="#FF6B5B" />
        </pattern>
        <pattern
          id="start-pat"
          patternUnits="userSpaceOnUse"
          width="10"
          height="10"
          patternTransform="rotate(-45)"
        >
          <rect width="10" height="10" fill="#FFFCEC" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="#F5C842" strokeWidth="2.5" />
        </pattern>
      </defs>
      {topLabel}
      {rolls}
      {rightLabel}
      {summaryRow}
    </svg>
  );
}

interface RollGroupProps {
  rollI: number;
  rollY: number;
  rollW: number;
  effectiveRollW: number;
  sidePad: number;
  usedCols: number;
  usedRows: number;
  hideEmptySlots: boolean;
  sheetX: number;
  sheetY: number;
  cols: number;
  rows: number;
  sheetsPerRoll: number;
  sheetsOnLastRoll: number;
  rollsNeeded: number;
  balancedPerSheet: number;
  lastSheetCount: number;
  sheetW: number;
  sheetH: number;
  stickerGrid: string;
  padX: number;
}

function RollGroup({
  rollI,
  rollY,
  rollW,
  effectiveRollW,
  sidePad: _fullSidePad,
  usedCols,
  usedRows,
  hideEmptySlots,
  sheetX,
  sheetY,
  cols,
  rows,
  sheetsPerRoll,
  sheetsOnLastRoll,
  rollsNeeded,
  balancedPerSheet,
  lastSheetCount,
  sheetW,
  sheetH,
  stickerGrid,
  padX,
}: RollGroupProps) {
  const isLastRoll = rollI === rollsNeeded - 1;
  const sheetsThisRoll = isLastRoll ? sheetsOnLastRoll : sheetsPerRoll;
  const contentW = usedCols * sheetY;
  const sidePad = Math.max(ROLL_MARGIN_X, (effectiveRollW - contentW) / 2);
  const annotFont = Math.max(22, effectiveRollW * 0.045);

  const sheets: React.ReactNode[] = [];
  let localIdx = 0;

  const colLimit = hideEmptySlots ? usedCols : cols;
  const rowLimit = hideEmptySlots ? usedRows : rows;

  for (let yy = 0; yy < colLimit; yy++) {
    for (let xx = 0; xx < rowLimit; xx++) {
      if (localIdx >= sheetsThisRoll) break;

      const sx = padX + ROLL_START_MARGIN + xx * sheetX;
      const sy = rollY + sidePad + yy * sheetY;
      const isVeryLast = isLastRoll && localIdx === sheetsThisRoll - 1;
      const stickersInThisSheet = isVeryLast ? lastSheetCount : balancedPerSheet;

      sheets.push(
        <SheetRect
          key={`s-${localIdx}`}
          x={sx + 4}
          y={sy + 4}
          width={sheetX - 8}
          height={sheetY - 8}
          label={`T${rollI * sheetsPerRoll + localIdx + 1}`}
          qty={stickersInThisSheet}
          sheetSize={`${sheetW}×${sheetH} · ${stickerGrid}`}
        />
      );
      localIdx++;
    }
    if (localIdx >= sheetsThisRoll) break;
  }

  if (!hideEmptySlots) {
    for (let yy = 0; yy < cols; yy++) {
      for (let xx = 0; xx < rows; xx++) {
        const idx = yy * rows + xx;
        if (idx < sheetsThisRoll) continue;
        const sx = padX + ROLL_START_MARGIN + xx * sheetX;
        const sy = rollY + sidePad + yy * sheetY;
        sheets.push(
          <EmptySheet
            key={`e-${idx}`}
            x={sx + 4}
            y={sy + 4}
            width={sheetX - 8}
            height={sheetY - 8}
          />
        );
      }
    }
  }

  const cutMarks = (
    <>
      <rect
        x={padX}
        y={rollY}
        width={ROLL_L}
        height={ROLL_MARGIN_X}
        fill="url(#cut-mark-pat)"
      />
      <text
        x={padX + ROLL_L / 2}
        y={rollY + ROLL_MARGIN_X / 2 + 5}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={annotFont}
        fill="#8B7B5C"
        fontWeight="700"
      >
        ↑ {ROLL_MARGIN_X}mm KESİM MARKASI
      </text>
      <rect
        x={padX}
        y={rollY + effectiveRollW - ROLL_MARGIN_X}
        width={ROLL_L}
        height={ROLL_MARGIN_X}
        fill="url(#cut-mark-pat)"
      />
      <text
        x={padX + ROLL_L / 2}
        y={rollY + effectiveRollW - ROLL_MARGIN_X / 2 + 5}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={annotFont}
        fill="#8B7B5C"
        fontWeight="700"
      >
        ↓ {ROLL_MARGIN_X}mm KESİM MARKASI
      </text>
    </>
  );

  const extraHavaUstte = sidePad - ROLL_MARGIN_X;
  const extraHava =
    !hideEmptySlots && extraHavaUstte > 0 ? (
      <>
        <rect
          x={padX}
          y={rollY + ROLL_MARGIN_X}
          width={ROLL_L}
          height={extraHavaUstte}
          fill="url(#fire-pat)"
        />
        <rect
          x={padX}
          y={rollY + effectiveRollW - sidePad}
          width={ROLL_L}
          height={extraHavaUstte}
          fill="url(#fire-pat)"
        />
      </>
    ) : null;

  const contentH = effectiveRollW - 2 * sidePad;
  const startArea = (
    <>
      <rect
        x={padX}
        y={rollY + sidePad}
        width={ROLL_START_MARGIN}
        height={contentH}
        fill="url(#start-pat)"
      />
      <text
        x={padX + ROLL_START_MARGIN / 2}
        y={rollY + effectiveRollW / 2}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={annotFont}
        fill="#1F2937"
        fontWeight="700"
        transform={`rotate(-90 ${padX + ROLL_START_MARGIN / 2} ${rollY + effectiveRollW / 2})`}
      >
        {ROLL_START_MARGIN}mm BAŞLANGIÇ
      </text>
    </>
  );

  const usedLength = usedRows * sheetX;
  const usableLength = ROLL_L - ROLL_START_MARGIN - ROLL_END_MARGIN;
  const slackInUsable = Math.max(0, usableLength - usedLength);
  const wasteEndX = padX + ROLL_START_MARGIN + usedLength;
  const wasteEndW = ROLL_END_MARGIN + slackInUsable;
  const endFire =
    wasteEndW > 0 ? (
      <>
        <rect
          x={wasteEndX}
          y={rollY + sidePad}
          width={wasteEndW}
          height={contentH}
          fill="url(#fire-pat)"
        />
        <text
          x={wasteEndX + wasteEndW / 2}
          y={rollY + effectiveRollW / 2}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={annotFont}
          fill="#8B7B5C"
          fontWeight="700"
          opacity="0.75"
        >
          {ROLL_END_MARGIN}mm bitiş
          {slackInUsable > 0 ? ` + ${slackInUsable}mm` : ""}
        </text>
      </>
    ) : null;

  return (
    <g>
      <rect
        x={padX}
        y={rollY}
        width={ROLL_L}
        height={effectiveRollW}
        fill="white"
        stroke="#1F2937"
        strokeWidth="2.5"
        rx="4"
      />
      {hideEmptySlots && effectiveRollW < rollW && (
        <text
          x={padX + ROLL_L - 12}
          y={rollY + effectiveRollW - 8}
          textAnchor="end"
          fontFamily="JetBrains Mono, monospace"
          fontSize={Math.max(18, annotFont * 0.85)}
          fill="#10B981"
          fontWeight="700"
        >
          {effectiveRollW}mm EN (dar)
        </text>
      )}
      {cutMarks}
      {extraHava}
      {startArea}
      {endFire}
      {sheets}
      <g transform={`translate(${padX - 22}, ${rollY + effectiveRollW / 2})`}>
        <text
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={annotFont}
          fill="#4B5563"
          fontWeight="700"
          transform="rotate(-90)"
        >
          RULO {rollI + 1}/{rollsNeeded}
        </text>
      </g>
    </g>
  );
}

function SheetRect({
  x,
  y,
  width,
  height,
  label,
  qty,
  sheetSize,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  qty: number;
  sheetSize: string;
}) {
  const qtySize = Math.min(72, Math.max(32, Math.min(width, height) * 0.14));
  const metaSize = Math.max(18, Math.min(width, height) * 0.045);
  const labelSize = Math.max(20, metaSize + 2);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#FFF8F2"
        stroke="#FF6B5B"
        strokeWidth="3"
        rx="6"
      />
      <rect
        x={x + 12}
        y={y + 12}
        width={width - 24}
        height={height - 24}
        fill="rgba(255, 107, 91, 0.08)"
        rx="3"
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize={qtySize}
        fontWeight="800"
        fill="#1F2937"
      >
        {qty}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + qtySize * 0.35}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize={metaSize}
        fill="#4B5563"
        fontWeight="600"
      >
        adet
      </text>
      <text
        x={x + 14}
        y={y + labelSize + 6}
        fontFamily="JetBrains Mono, monospace"
        fontSize={labelSize}
        fill="#FF6B5B"
        fontWeight="700"
      >
        {label}
      </text>
      <text
        x={x + width - 14}
        y={y + height - 12}
        textAnchor="end"
        fontFamily="JetBrains Mono, monospace"
        fontSize={metaSize}
        fill="#6B7280"
        fontWeight="600"
      >
        {sheetSize}
      </text>
    </g>
  );
}

function EmptySheet({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#C4B091"
        strokeWidth="1.8"
        strokeDasharray="8,5"
        rx="6"
        opacity="0.6"
      />
      <text
        x={x + width / 2}
        y={y + height / 2 + 7}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="24"
        fill="#9CA3AF"
        opacity="0.7"
      >
        boş
      </text>
    </g>
  );
}
