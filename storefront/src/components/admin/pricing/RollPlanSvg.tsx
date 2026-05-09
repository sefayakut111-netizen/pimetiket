/**
 * RollPlanSvg — büyük plotter rulosu üstündeki tabaka dizgisi.
 *
 * sticker-fiyatlama.html v0.3 → renderRollPlan() port'u.
 *
 * Görsel:
 *   - Yatay rulo (X = boy 1520mm, Y = en dinamik 250-600mm)
 *   - Üst+alt 40mm kesim markası (mercan dotted pattern)
 *   - Sol 50mm plotter başlangıcı (sarı stripe pattern)
 *   - Tabakalar grid içinde, dolu = "X adet", boş = dashed
 *   - Son rulonun sağ kısmında fire (cream zigzag)
 *   - Min eni dayandığında ekstra hava (üst+alt cream zigzag)
 *   - Üst rulo kapağında "1520 mm BOY" etiketi
 *   - Sağda "rollW mm EN" etiketi + tasarruf bilgisi
 *   - 3 ruloya kadar göster, daha çoksa "+ N rulo daha" özet
 */

import {
  ROLL_L,
  ROLL_MARGIN_X,
  ROLL_MARGIN_Y,
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

  // SVG'de rulo yatay çizilir: X = boy yönü (ROLL_L=1520mm), Y = en yönü (rollW)
  const rollW = roll.rollW;
  const usedW = roll.cols * fit.sheetW;
  const sidePad = (rollW - usedW) / 2; // her iki tarafa eşit boşluk

  // Tabaka X = boy yönünde dizilen kenar (sheetH boyut adına rağmen rulo akışında uzun olan)
  const SHEET_X = fit.sheetH;
  const SHEET_Y = fit.sheetW;

  const rollsToShow = Math.min(roll.rollsNeeded, maxRollsToShow);
  const showSummary = roll.rollsNeeded > maxRollsToShow;

  const PAD_X = 80; // sol etiketler ("RULO N/M" rotated) + sağ EN etiketi için
  const PAD_TOP = 45;
  const PAD_BOTTOM = 30;
  const ROLL_GAP = 60;

  const totalSvgWidth = ROLL_L + PAD_X * 2;
  const totalSvgHeight =
    (rollW + ROLL_GAP) * rollsToShow +
    PAD_TOP +
    PAD_BOTTOM +
    (showSummary ? 40 : 0);

  // Build roll groups
  const rolls: React.ReactNode[] = [];
  for (let rollI = 0; rollI < rollsToShow; rollI++) {
    rolls.push(
      <RollGroup
        key={rollI}
        rollI={rollI}
        rollW={rollW}
        sidePad={sidePad}
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
        padX={PAD_X}
        padTop={PAD_TOP}
        rollGap={ROLL_GAP}
      />
    );
  }

  // Top dimension label (1520mm BOY) — only on first roll
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
        fontSize="18"
        fill="#1F2937"
        fontWeight="700"
      >
        1520 mm BOY
      </text>
    </g>
  );

  // Right en label
  const rightLabel = (
    <g transform={`translate(${PAD_X + ROLL_L + 24}, ${PAD_TOP + rollW / 2})`}>
      <text
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="18"
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
          fontSize="13"
          fill="#10B981"
          fontWeight="600"
          transform={`rotate(90) translate(0, 20)`}
        >
          ({ROLL_W_MAX - rollW}mm tasarruf)
        </text>
      )}
    </g>
  );

  // Summary row if more than maxRollsToShow
  const summaryRow = showSummary ? (
    <g>
      <rect
        x={PAD_X}
        y={PAD_TOP + maxRollsToShow * (rollW + ROLL_GAP)}
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
        y={PAD_TOP + maxRollsToShow * (rollW + ROLL_GAP) + 21}
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="13"
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

// ============================================================
// Single roll group
// ============================================================

interface RollGroupProps {
  rollI: number;
  rollW: number;
  sidePad: number;
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
  padX: number;
  padTop: number;
  rollGap: number;
}

function RollGroup({
  rollI,
  rollW,
  sidePad,
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
  padX,
  padTop,
  rollGap,
}: RollGroupProps) {
  const isLastRoll = rollI === rollsNeeded - 1;
  const sheetsThisRoll = isLastRoll ? sheetsOnLastRoll : sheetsPerRoll;
  const rollY = padTop + rollI * (rollW + rollGap);

  // Build sheets
  // FILL ORDER (matches sticker-fiyatlama.html): outer = cols (en), inner = rows (boy)
  // T1 = en-col=0, boy-row=0 (leftmost-top)
  // T2 = en-col=0, boy-row=1 (one cell right along boy)
  // T(rows+1) = en-col=1, boy-row=0 (next en-row down)
  const sheets: React.ReactNode[] = [];
  let localIdx = 0;

  for (let yy = 0; yy < cols; yy++) {
    for (let xx = 0; xx < rows; xx++) {
      const sx = padX + ROLL_MARGIN_Y + xx * sheetX; // X axis = rulo BOY (xx iterates rows)
      const sy = rollY + sidePad + yy * sheetY; // Y axis = rulo EN (yy iterates cols)
      const isUsed = localIdx < sheetsThisRoll;
      const isVeryLast = isLastRoll && localIdx === sheetsThisRoll - 1;
      const stickersInThisSheet = isVeryLast ? lastSheetCount : balancedPerSheet;

      if (isUsed) {
        sheets.push(
          <SheetRect
            key={`s-${localIdx}`}
            x={sx + 4}
            y={sy + 4}
            width={sheetX - 8}
            height={sheetY - 8}
            label={`T${rollI * sheetsPerRoll + localIdx + 1}`}
            qty={stickersInThisSheet}
            sheetSize={`${sheetW}×${sheetH}mm`}
          />
        );
      } else {
        sheets.push(
          <EmptySheet
            key={`e-${localIdx}`}
            x={sx + 4}
            y={sy + 4}
            width={sheetX - 8}
            height={sheetY - 8}
          />
        );
      }
      localIdx++;
    }
  }

  // Cut mark areas (top + bottom 40mm)
  const cutMarks = (
    <>
      {/* Top cut mark */}
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
        fontSize="16"
        fill="#8B7B5C"
        fontWeight="700"
      >
        ↑ 40mm KESİM MARKASI
      </text>
      {/* Bottom cut mark */}
      <rect
        x={padX}
        y={rollY + rollW - ROLL_MARGIN_X}
        width={ROLL_L}
        height={ROLL_MARGIN_X}
        fill="url(#cut-mark-pat)"
      />
      <text
        x={padX + ROLL_L / 2}
        y={rollY + rollW - ROLL_MARGIN_X / 2 + 5}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="16"
        fill="#8B7B5C"
        fontWeight="700"
      >
        ↓ 40mm KESİM MARKASI
      </text>
    </>
  );

  // Extra hava if min rulo eni dayandı
  const extraHavaUstte = sidePad - ROLL_MARGIN_X;
  const extraHava =
    extraHavaUstte > 0 ? (
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
          y={rollY + rollW - sidePad}
          width={ROLL_L}
          height={extraHavaUstte}
          fill="url(#fire-pat)"
        />
      </>
    ) : null;

  // Plotter başlangıç (sol 50mm)
  const startArea = (
    <>
      <rect
        x={padX}
        y={rollY + sidePad}
        width={ROLL_MARGIN_Y}
        height={rollW - 2 * sidePad}
        fill="url(#start-pat)"
      />
      <text
        x={padX + ROLL_MARGIN_Y / 2}
        y={rollY + rollW / 2}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="14"
        fill="#1F2937"
        fontWeight="700"
        transform={`rotate(-90 ${padX + ROLL_MARGIN_Y / 2} ${rollY + rollW / 2})`}
      >
        50mm BAŞLANGIÇ
      </text>
    </>
  );

  // Tabakaların boy yönündeki kullanılmayan kısmı (fire — son rulo'da)
  const lastRowsCount = isLastRoll ? Math.ceil(sheetsOnLastRoll / cols) : rows;
  const usedLength = lastRowsCount * sheetX;
  const wasteEndX = padX + ROLL_MARGIN_Y + usedLength;
  const wasteEndW = ROLL_L - ROLL_MARGIN_Y - usedLength;
  const endFire =
    wasteEndW > 0 ? (
      <>
        <rect
          x={wasteEndX}
          y={rollY + sidePad}
          width={wasteEndW}
          height={rollW - 2 * sidePad}
          fill="url(#fire-pat)"
        />
        <text
          x={wasteEndX + wasteEndW / 2}
          y={rollY + rollW / 2}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="22"
          fill="#8B7B5C"
          fontWeight="700"
          opacity="0.75"
        >
          {wasteEndW}mm boş
        </text>
      </>
    ) : null;

  return (
    <g>
      {/* Roll outer rect */}
      <rect
        x={padX}
        y={rollY}
        width={ROLL_L}
        height={rollW}
        fill="white"
        stroke="#1F2937"
        strokeWidth="2.5"
        rx="4"
      />
      {cutMarks}
      {extraHava}
      {startArea}
      {endFire}
      {sheets}
      {/* Roll label rotated on left */}
      <g transform={`translate(${padX - 22}, ${rollY + rollW / 2})`}>
        <text
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="18"
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

// ============================================================
// Filled sheet rect with adet count
// ============================================================

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
      {/* QTY — büyük rakam ortalanır */}
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="64"
        fontWeight="800"
        fill="#1F2937"
      >
        {qty}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 28}
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="22"
        fill="#4B5563"
        fontWeight="600"
      >
        adet
      </text>
      {/* T-label */}
      <text
        x={x + 14}
        y={y + 28}
        fontFamily="JetBrains Mono, monospace"
        fontSize="20"
        fill="#FF6B5B"
        fontWeight="700"
      >
        {label}
      </text>
      {/* Sheet size */}
      <text
        x={x + width - 14}
        y={y + height - 12}
        textAnchor="end"
        fontFamily="JetBrains Mono, monospace"
        fontSize="14"
        fill="#9CA3AF"
        fontWeight="500"
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
        fontSize="20"
        fill="#9CA3AF"
        opacity="0.7"
      >
        boş
      </text>
    </g>
  );
}
