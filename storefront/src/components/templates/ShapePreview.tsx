"use client";

import type { DieCutTemplate, CutSet } from "@/lib/templates/die-cut-templates";
import { CUT_SET_META } from "@/lib/templates/die-cut-templates";

export function ShapePreview({
  tpl,
  set,
  box = 120,
}: {
  tpl: DieCutTemplate;
  set: CutSet;
  box?: number;
}) {
  const color = CUT_SET_META[set].color;
  const pad = 10;
  const maxDim = Math.max(tpl.widthMm, tpl.heightMm);
  const scale = (box - pad * 2) / maxDim;
  const w = tpl.widthMm * scale;
  const h = tpl.heightMm * scale;
  const cx = box / 2;
  const cy = box / 2;
  const strokeW = 1.5;

  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      role="img"
      aria-label={tpl.label}
      className="shrink-0"
    >
      {tpl.shape === "circle" && (
        <circle
          cx={cx}
          cy={cy}
          r={w / 2}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
        />
      )}
      {tpl.shape === "ellipse" && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={w / 2}
          ry={h / 2}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
        />
      )}
      {tpl.shape === "rect" && (
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={tpl.cornerRadiusMm * scale}
          ry={tpl.cornerRadiusMm * scale}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
        />
      )}
    </svg>
  );
}
