export function SayfaBoyutIkon({ w, h }: { w: number; h: number }) {
  const BOX = 46;
  const PAD = 5;
  const inner = BOX - 2 * PAD;
  const s = inner / Math.max(w, h);
  const rw = Math.max(6, w * s);
  const rh = Math.max(6, h * s);
  const x = (BOX - rw) / 2;
  const y = (BOX - rh) / 2;
  const cols = rw >= rh ? 3 : 2;
  const rows = rw >= rh ? 2 : 3;
  const gap = 1.2;
  const cw = (rw - (cols + 1) * gap) / cols;
  const ch = (rh - (rows + 1) * gap) / rows;
  const cells = [];
  if (cw > 1.5 && ch > 1.5) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        cells.push(
          <rect
            key={`${i}-${j}`}
            x={x + gap + i * (cw + gap)}
            y={y + gap + j * (ch + gap)}
            width={cw}
            height={ch}
            rx="0.8"
            fill="#FF6B5B"
            opacity="0.18"
          />
        );
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
        fill="#FFF8F2"
        stroke="#FF6B5B"
        strokeWidth="1.5"
      />
      {cells}
    </svg>
  );
}
