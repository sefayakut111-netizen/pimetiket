/**
 * Pim ölçü referans tablosu — Katman 1 (kesin değerler).
 * @see docs/PIM-EDITOR-KOMUT-SPEC.md
 */

export type SizeReferenceShape = "circle" | "rect";

export interface SizeReferenceEntry {
  /** Türkçe arama anahtarları (küçük harf) */
  keywords: readonly string[];
  widthMm: number;
  heightMm: number;
  shape: SizeReferenceShape;
  /** rect için köşe yarıçapı mm (opsiyonel) */
  cornerRadiusMm?: number;
  labelTr: string;
}

/** 1 TL ≈ 26.15 mm çap (TCMB madeni para spec) */
export const SIZE_REFERENCES: readonly SizeReferenceEntry[] = [
  {
    keywords: ["1 tl", "1 lira", "madeni para", "para boyutu", "tl boyutu"],
    widthMm: 26.15,
    heightMm: 26.15,
    shape: "circle",
    labelTr: "1 TL madeni para",
  },
  {
    keywords: ["50 kuruş", "50 kurus", "elli kuruş"],
    widthMm: 23.85,
    heightMm: 23.85,
    shape: "circle",
    labelTr: "50 kuruş",
  },
  {
    keywords: ["kartvizit", "business card"],
    widthMm: 85,
    heightMm: 55,
    shape: "rect",
    cornerRadiusMm: 3,
    labelTr: "Kartvizit",
  },
  {
    keywords: ["kredi kartı", "banka kartı", "bank karti", "credit card"],
    widthMm: 85.6,
    heightMm: 53.98,
    shape: "rect",
    cornerRadiusMm: 3,
    labelTr: "Kredi/banka kartı",
  },
  {
    keywords: ["cd", "dvd", "cd/dvd"],
    widthMm: 120,
    heightMm: 120,
    shape: "circle",
    labelTr: "CD/DVD",
  },
  {
    keywords: ["bardak altı", "bardak alti", "coaster"],
    widthMm: 90,
    heightMm: 90,
    shape: "circle",
    labelTr: "Bardak altı",
  },
  {
    keywords: ["a6", "kartpostal", "postcard"],
    widthMm: 148,
    heightMm: 105,
    shape: "rect",
    labelTr: "A6 / kartpostal",
  },
  {
    keywords: ["a7"],
    widthMm: 105,
    heightMm: 74,
    shape: "rect",
    labelTr: "A7",
  },
] as const;

/** Kullanıcı metninden tablo eşleşmesi (basit keyword scan). */
export function lookupSizeReference(text: string): SizeReferenceEntry | null {
  const norm = text.toLocaleLowerCase("tr-TR").trim();
  if (!norm) return null;
  for (const entry of SIZE_REFERENCES) {
    if (entry.keywords.some((k) => norm.includes(k))) {
      return entry;
    }
  }
  return null;
}
