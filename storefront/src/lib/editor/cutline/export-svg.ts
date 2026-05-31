import { pathRingToSvgD } from "@/lib/editor/cutline/shapes";
import type { CutlineBundle } from "@/lib/editor/cutline/types";

/** Üretim SVG — viewBox mm (0…labelW × 0…labelH) */
export function buildCutlineSvgMm(args: {
  bundle: CutlineBundle;
  labelWidthMm: number;
  labelHeightMm: number;
}): string {
  const w = args.labelWidthMm;
  const h = args.labelHeightMm;
  let pathsXml = "";
  for (const ring of args.bundle.cut) {
    const d = pathRingToSvgD(ring);
    if (!d) continue;
    pathsXml += `    <path d="${d.replace(/"/g, "'")}" fill="none" stroke="#FF0080" stroke-width="0.35"/>\n`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${w.toFixed(2)}" height="${h.toFixed(2)}"
     viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">
  <g id="CutContour" data-pim-cutline="true">
${pathsXml}  </g>
</svg>`;
}

export function buildEditorCutlineMeta(args: {
  mode: string;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  bundle: CutlineBundle;
  imagePlacement: { x: number; y: number; scale: number };
}): Record<string, unknown> {
  return {
    source: "raster",
    mode: args.mode,
    offset_mm: args.offsetMm,
    smoothness: 0,
    dpi: null,
    width_mm: args.widthMm,
    height_mm: args.heightMm,
    cutline_width_mm: args.bundle.cutlineWidthMm,
    cutline_height_mm: args.bundle.cutlineHeightMm,
    image_placement: args.imagePlacement,
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
