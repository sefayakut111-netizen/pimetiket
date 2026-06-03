import type { ReactNode } from "react";

const BOX = 46;
const PAD = 5;
const ACCENT = "#FF6B5B";
const SHEET_FILL = "#FFF8F2";

// 24×24 kutuda merkezlenmiş Material ikon path'leri
const STAR_D =
  "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
const HEART_D =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

type Sym = "star" | "heart" | "dot";

function symbolAt(type: Sym, cx: number, cy: number, sz: number, key: string) {
  if (type === "dot") {
    return (
      <circle key={key} cx={cx} cy={cy} r={sz * 0.42} fill={ACCENT} opacity={0.5} />
    );
  }
  const d = type === "star" ? STAR_D : HEART_D;
  const k = sz / 24;
  return (
    <path
      key={key}
      d={d}
      transform={`translate(${(cx - sz / 2).toFixed(2)} ${(cy - sz / 2).toFixed(2)}) scale(${k.toFixed(3)})`}
      fill={ACCENT}
      opacity={0.5}
    />
  );
}

export function SayfaBoyutIkon({ w, h }: { w: number; h: number }) {
  const inner = BOX - 2 * PAD;
  const s = inner / Math.max(w, h);
  const rw = Math.max(6, w * s);
  const rh = Math.max(6, h * s);
  const x = (BOX - rw) / 2;
  const y = (BOX - rh) / 2;

  // Sayfaya kaç sembol sığar — orana göre 3 (şerit) veya 4 (kare/A-serisi)
  const ratio = rw / rh;
  let cols: number;
  let rows: number;
  if (ratio > 2.0) {
    cols = 3;
    rows = 1; // yatay şerit → 3 sembol
  } else if (ratio < 0.5) {
    cols = 1;
    rows = 3; // dikey şerit → 3 sembol
  } else {
    cols = 2;
    rows = 2; // kare / A-serisi → 4 sembol
  }

  const gap = 1.4;
  const cw = (rw - (cols + 1) * gap) / cols;
  const ch = (rh - (rows + 1) * gap) / rows;
  const sz = Math.max(3, Math.min(cw, ch) * 0.92);

  const SYMS: Sym[] = ["star", "heart", "dot", "star"];
  const symbols: ReactNode[] = [];
  if (cw > 2 && ch > 2) {
    let idx = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = x + gap + i * (cw + gap) + cw / 2;
        const cy = y + gap + j * (ch + gap) + ch / 2;
        symbols.push(symbolAt(SYMS[idx % SYMS.length], cx, cy, sz, `${i}-${j}`));
        idx++;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${BOX} ${BOX}`}
      width={BOX}
      height={BOX}
      role="img"
      aria-label={`${w}×${h} mm sayfa`}
    >
      <rect
        x={x}
        y={y}
        width={rw}
        height={rh}
        rx="2"
        fill={SHEET_FILL}
        stroke={ACCENT}
        strokeWidth="1.5"
      />
      {symbols}
    </svg>
  );
}
