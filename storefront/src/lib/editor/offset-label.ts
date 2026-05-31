/** Kesim mesafesi slider etiketi (POC offsetNote ile uyumlu). */

/** Range input'un step kayması (ör. -1e-16) sıfırı boş bırakmasın diye snap. */
function snapMm(offsetMm: number): number {
  const v = Math.round(offsetMm * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
}

export function formatOffsetLabel(offsetMm: number): string {
  const v = snapMm(offsetMm);
  if (v === 0) return "Sıfır kesim";
  if (v < 0) return `${Math.abs(v).toFixed(1)} mm içeri`;
  return `${v.toFixed(1)} mm dışarı`;
}

export function offsetNoteText(offsetMm: number): string | null {
  offsetMm = snapMm(offsetMm);
  if (offsetMm === 0) {
    return "Sıfır kesim — kayma toleransı için bıçak 0,3 mm içerden geçirilir.";
  }
  if (offsetMm < 0) {
    return `Bıçak görselin ${Math.abs(offsetMm).toFixed(1)} mm içinden geçer.`;
  }
  if (offsetMm < 1) {
    return "Dar kesim — makine toleransına dikkat; 2 mm önerilir.";
  }
  if (offsetMm > 4) {
    return "Geniş kesim — şeffaf folyo kenarı genişler.";
  }
  return null;
}
