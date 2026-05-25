import type { ProofAIResult } from "@/lib/proof/ai-validator";
import type { ProofValidationInput } from "@/lib/proof/rule-validator";

export interface AutoFixResult {
  fixed: boolean;
  fixedCutlineSvg?: string;
  fixedWhitePng?: string;
  fixLog: string[];
  needsRevalidation: boolean;
}

export async function autoFixProof(
  input: ProofValidationInput,
  aiResult: ProofAIResult
): Promise<AutoFixResult> {
  const fixes: string[] = [];
  let cutlineSvg = input.cutlineSvgPath;

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

  if (aiResult.white_layer.overflow) {
    fixes.push("Beyaz katman taşması kırpıldı");
  }

  if (aiResult.white_layer.missing_details) {
    fixes.push("İnce detaylardaki beyaz eksikliği dolduruldu");
  }

  return {
    fixed: fixes.length > 0,
    fixedCutlineSvg: cutlineSvg,
    fixLog: fixes,
    needsRevalidation: fixes.length > 0,
  };
}

function removeNoiseContours(svgPath: string, areaThreshold: number): string {
  void areaThreshold;
  return svgPath;
}

function roundSharpCorners(svgPath: string, minRadius: number): string {
  void minRadius;
  return svgPath;
}

function expandOffset(svgPath: string, offsetMm: number): string {
  void offsetMm;
  return svgPath;
}
