/** Kesim mesafesi slider etiketi (POC offsetNote ile uyumlu). */

export function formatOffsetLabel(offsetMm: number): string {
  if (offsetMm === 0) return "Sıfır kesim";
  if (offsetMm < 0) return `${Math.abs(offsetMm).toFixed(1)} mm içeri`;
  return `${offsetMm.toFixed(1)} mm dışarı`;
}

export function offsetNoteText(offsetMm: number): string | null {
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
