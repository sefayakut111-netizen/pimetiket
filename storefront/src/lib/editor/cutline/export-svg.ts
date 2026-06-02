import {
  pathRingToSvgD,
  roundedRectPathMm,
} from "@/lib/editor/cutline/shapes";
import type { CutlineBundle, PathRing } from "@/lib/editor/cutline/types";
import type { CutSet } from "@/lib/templates/die-cut-templates";
import { CUT_SET_META } from "@/lib/templates/die-cut-templates";

/** Kartlı Sticker — Sefa onaylı default geometri */
export const KARTLI_MARGIN_MM = 5;
export const KARTLI_CARD_RADIUS_MM = 4;

function offsetRing(ring: PathRing, dx: number, dy: number): PathRing {
  return ring.map(([x, y]) => [x + dx, y + dy]);
}

/** Üretim SVG — viewBox mm (0…labelW × 0…labelH) */
export function buildCutlineSvgMm(args: {
  bundle: CutlineBundle;
  labelWidthMm: number;
  labelHeightMm: number;
  cutType?: CutSet;
}): string {
  const w = args.labelWidthMm;
  const h = args.labelHeightMm;
  const cutType = args.cutType ?? "kisscut";
  const { spot, color } = CUT_SET_META[cutType];
  let pathsXml = "";
  for (const ring of args.bundle.cut) {
    const d = pathRingToSvgD(ring);
    if (!d) continue;
    pathsXml += `    <path d="${d.replace(/"/g, "'")}" fill="none" stroke="${color}" stroke-width="0.35"/>\n`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${w.toFixed(2)}" height="${h.toFixed(2)}"
     viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">
  <g id="${spot}" data-pim-cutline="true" data-pim-cut-type="${cutType}">
${pathsXml}  </g>
</svg>`;
}

/** Kartlı Sticker — dış ThruCut kart + iç KissCut silüet (iki spot grubu) */
export function buildKartliCutlineSvgMm(args: {
  bundle: CutlineBundle;
  stickerWidthMm: number;
  stickerHeightMm: number;
  marginMm?: number;
  cardRadiusMm?: number;
}): string {
  const marginMm = args.marginMm ?? KARTLI_MARGIN_MM;
  const cardRadiusMm = args.cardRadiusMm ?? KARTLI_CARD_RADIUS_MM;
  const cardW = args.stickerWidthMm + 2 * marginMm;
  const cardH = args.stickerHeightMm + 2 * marginMm;
  const thrucut = CUT_SET_META.thrucut;
  const kisscut = CUT_SET_META.kisscut;

  const outerRing = roundedRectPathMm(0, 0, cardW, cardH, cardRadiusMm);
  const outerD = pathRingToSvgD(outerRing);
  const outerPath = outerD
    ? `    <path d="${outerD.replace(/"/g, "'")}" fill="none" stroke="${thrucut.color}" stroke-width="0.35"/>\n`
    : "";

  let innerPathsXml = "";
  for (const ring of args.bundle.cut) {
    const shifted = offsetRing(ring, marginMm, marginMm);
    const d = pathRingToSvgD(shifted);
    if (!d) continue;
    innerPathsXml += `    <path d="${d.replace(/"/g, "'")}" fill="none" stroke="${kisscut.color}" stroke-width="0.35"/>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${cardW.toFixed(2)}" height="${cardH.toFixed(2)}"
     viewBox="0 0 ${cardW.toFixed(2)} ${cardH.toFixed(2)}">
  <g id="${thrucut.spot}" data-pim-cutline="true" data-pim-cut-type="thrucut">
${outerPath}  </g>
  <g id="${kisscut.spot}" data-pim-cutline="true" data-pim-cut-type="kisscut">
${innerPathsXml}  </g>
</svg>`;
}

export function buildEditorCutlineMeta(args: {
  mode: string;
  offsetMm: number;
  smoothness: number;
  widthMm: number;
  heightMm: number;
  bundle: CutlineBundle;
  imagePlacement: { x: number; y: number; scale: number };
  bladeTransform?: { offsetXmm: number; offsetYmm: number; scale: number };
}): Record<string, unknown> {
  return {
    source: "raster",
    mode: args.mode,
    offset_mm: args.offsetMm,
    smoothness: args.smoothness,
    dpi: null,
    width_mm: args.widthMm,
    height_mm: args.heightMm,
    cutline_width_mm: args.bundle.cutlineWidthMm,
    cutline_height_mm: args.bundle.cutlineHeightMm,
    image_placement: args.imagePlacement,
    blade_transform: args.bladeTransform ?? null,
    pim_feedback: null,
    pim_severity: "ok",
    material_type: "paper",
    white_plan_mode: "off",
    white_plan_path_count: 0,
    has_custom_white_plan: false,
    tier: "pro",
    detected_cut_contour_names: [],
  };
}
