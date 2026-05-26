import type { ProofAIResult } from "@/lib/proof/ai-validator";
import type { ProofValidationInput } from "@/lib/proof/rule-validator";
import {
  clipWhiteLayerToCutline,
  generateWhiteLayer,
} from "@/lib/proof/white-layer";

export interface AutoFixResult {
  fixed: boolean;
  fixedCutlineSvg?: string;
  fixedWhitePng?: string;
  fixLog: string[];
  needsRevalidation: boolean;
}

export interface AutoFixContext {
  designFileUrl?: string;
  orderId?: string;
  itemId?: string;
  whiteLayerPngUrl?: string;
}

export async function autoFixProof(
  input: ProofValidationInput,
  aiResult: ProofAIResult,
  ctx: AutoFixContext = {}
): Promise<AutoFixResult> {
  const fixes: string[] = [];
  let cutlineSvg = input.cutlineSvgPath;
  let fixedWhitePng: string | undefined;

  if (aiResult.cutline.noise_contours) {
    cutlineSvg = removeNoiseContours(cutlineSvg, 0.05);
    fixes.push("Gürültü konturları temizlendi");
  }

  if (aiResult.cutline.sharp_corners) {
    cutlineSvg = roundSharpCorners(cutlineSvg, 0.5);
    fixes.push("Keskin köşeler 0.5mm radius ile yuvarlandı");
  }

  if (!aiResult.cutline.offset_adequate) {
    cutlineSvg = expandOffset(cutlineSvg, 1.5);
    fixes.push("Bıçak ofseti 1.5mm olarak ayarlandı");
  }

  if (aiResult.white_layer.overflow && ctx.whiteLayerPngUrl) {
    const clipped = await clipWhiteLayerToCutline({
      whitePngUrl: ctx.whiteLayerPngUrl,
      cutlineSvgPath: cutlineSvg,
      designWidth: input.designWidth,
      designHeight: input.designHeight,
      orderId: ctx.orderId,
      itemId: ctx.itemId,
    });
    if (clipped?.pngUrl) {
      fixedWhitePng = clipped.pngUrl;
      fixes.push("Beyaz katman taşması kırpıldı");
    }
  }

  if (
    aiResult.white_layer.missing_details &&
    ctx.designFileUrl &&
    cutlineSvg.trim()
  ) {
    const regen = await generateWhiteLayer({
      designFileUrl: ctx.designFileUrl,
      cutlineSvgPath: cutlineSvg,
      materialKey: input.materialKey,
      designWidth: input.designWidth,
      designHeight: input.designHeight,
      orderId: ctx.orderId,
      itemId: ctx.itemId,
      alphaThreshold: 64,
    });
    if (regen.generated && regen.whitePngUrl) {
      fixedWhitePng = regen.whitePngUrl;
      fixes.push("İnce detaylardaki beyaz eksikliği dolduruldu");
    }
  }

  return {
    fixed: fixes.length > 0,
    fixedCutlineSvg: cutlineSvg,
    fixedWhitePng,
    fixLog: fixes,
    needsRevalidation: fixes.length > 0,
  };
}

function pathBoundingBox(d: string): { area: number; len: number } {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  if (nums.length < 4) return { area: 0, len: d.length };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  const area = (maxX - minX) * (maxY - minY);
  return { area: Number.isFinite(area) ? area : 0, len: d.length };
}

function removeNoiseContours(svgPath: string, areaThreshold: number): string {
  if (!svgPath.includes("<path")) return svgPath;
  const pathRegex = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*\/?>/gi;
  const paths: Array<{ html: string; area: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svgPath)) !== null) {
    const bb = pathBoundingBox(match[1]);
    paths.push({ html: match[0], area: bb.area });
  }
  if (paths.length <= 1) return svgPath;

  const maxArea = Math.max(...paths.map((p) => p.area), 1);
  const minArea = maxArea * areaThreshold;
  const kept = paths.filter((p) => p.area >= minArea).map((p) => p.html);
  if (kept.length === 0) return svgPath;

  const open =
    svgPath.match(/<svg[^>]*>/i)?.[0] ??
    '<svg xmlns="http://www.w3.org/2000/svg">';
  return `${open}${kept.join("")}</svg>`;
}

function roundSharpCorners(svgPath: string, minRadius: number): string {
  if (!svgPath.includes("<path")) return svgPath;
  return svgPath.replace(
    /stroke-width="([^"]+)"/g,
    (_, w) => {
      const n = Number(w);
      const next = Number.isFinite(n) ? Math.max(n, minRadius) : minRadius;
      return `stroke-width="${next}"`;
    }
  );
}

function expandOffset(svgPath: string, offsetMm: number): string {
  const strokeWidth = offsetMm * 2;
  let out = svgPath;
  if (!out.includes("stroke-width")) {
    out = out.replace(/<path\b/i, `<path stroke-width="${strokeWidth}"`);
  } else {
    out = out.replace(/stroke-width="([^"]+)"/, (_, w) => {
      const n = Number(w);
      return `stroke-width="${Number.isFinite(n) ? Math.max(n, strokeWidth) : strokeWidth}"`;
    });
  }
  if (!out.includes("Offset:")) {
    return out.replace(/<\/svg>/i, `<!-- Offset: ${offsetMm}mm --></svg>`);
  }
  return out.replace(/Offset:\s*[\d.]+mm/, `Offset: ${offsetMm}mm`);
}
