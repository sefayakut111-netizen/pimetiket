export type CutlineMode = "contour" | "hull" | "rect" | "circle";

/** Kapalı kontur — [x,y] çiftleri (mm veya px; bağlamda belirtilir) */
export type PathRing = [number, number][];

export interface CutlineBundle {
  cut: PathRing[];
  bleed: PathRing[];
  safe: PathRing[];
  cutlineWidthMm: number;
  cutlineHeightMm: number;
}

export interface ImagePlacementMm {
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
}

export interface ComputeCutlineInput {
  mode: CutlineMode;
  labelWidthMm: number;
  labelHeightMm: number;
  offsetMm: number;
  cornerRadiusMm?: number;
  smoothness?: number;
  image?: HTMLImageElement | null;
  imagePlacementMm?: ImagePlacementMm;
}
