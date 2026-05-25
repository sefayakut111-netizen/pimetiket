import { needsWhiteLayer } from "@/lib/design-file-types";

export interface ProofValidationInput {
  designWidth: number;
  designHeight: number;
  cutlineSvgPath: string;
  cutlinePartCount: number;
  cutlineOffset: number;
  whiteLayerExists: boolean;
  whiteCoverage: number;
  materialKey: string;
  fileCategory: "processable" | "qc_only";
}

export interface RuleIssue {
  area: "cutline" | "white_layer" | "geometry";
  severity: "error" | "warning" | "info";
  code: string;
  message_tr: string;
  autoFixable: boolean;
}

export interface RuleCheckResult {
  passed: boolean;
  issues: RuleIssue[];
}

export function runProofRuleCheck(input: ProofValidationInput): RuleCheckResult {
  const issues: RuleIssue[] = [];
  const needsWhite = needsWhiteLayer(input.materialKey);

  if (input.cutlinePartCount === 0) {
    issues.push({
      area: "cutline",
      severity: "error",
      code: "NO_CONTOUR",
      message_tr: "Bıçak çizimi bulunamadı",
      autoFixable: false,
    });
  }

  if (input.cutlinePartCount > 8) {
    issues.push({
      area: "cutline",
      severity: "warning",
      code: "TOO_MANY_CONTOURS",
      message_tr: `${input.cutlinePartCount} ayrı kesim parçası — gürültü olabilir`,
      autoFixable: true,
    });
  }

  if (input.cutlineOffset < 1) {
    issues.push({
      area: "cutline",
      severity: "warning",
      code: "LOW_OFFSET",
      message_tr: "Bıçak ofseti 1mm altında — kesim kayması riski",
      autoFixable: true,
    });
  }

  const sharpCorners = countSharpCorners(input.cutlineSvgPath, 0.5);
  if (sharpCorners > 0) {
    issues.push({
      area: "cutline",
      severity: "warning",
      code: "SHARP_CORNERS",
      message_tr: `${sharpCorners} keskin köşe — die-cut makinesi zorlanabilir`,
      autoFixable: true,
    });
  }

  if (needsWhite && !input.whiteLayerExists) {
    issues.push({
      area: "white_layer",
      severity: "error",
      code: "WHITE_MISSING",
      message_tr:
        "Şeffaf/metalik malzeme — beyaz katman gerekli ama üretilmedi",
      autoFixable: true,
    });
  }

  if (!needsWhite && input.whiteLayerExists && input.whiteCoverage > 5) {
    issues.push({
      area: "white_layer",
      severity: "info",
      code: "WHITE_UNNECESSARY",
      message_tr: "Opak malzemede beyaz katman gereksiz",
      autoFixable: true,
    });
  }

  if (needsWhite && input.whiteCoverage > 95) {
    issues.push({
      area: "white_layer",
      severity: "warning",
      code: "WHITE_FULL_COVERAGE",
      message_tr: "Beyaz katman %95+ — arka plan temizlenmemiş olabilir",
      autoFixable: false,
    });
  }

  if (needsWhite && input.whiteCoverage > 0 && input.whiteCoverage < 20) {
    issues.push({
      area: "white_layer",
      severity: "warning",
      code: "WHITE_LOW_COVERAGE",
      message_tr: "Beyaz katman %20 altında — ince detaylar kaybolabilir",
      autoFixable: false,
    });
  }

  if (input.designWidth < 15 || input.designHeight < 15) {
    issues.push({
      area: "geometry",
      severity: "warning",
      code: "TOO_SMALL",
      message_tr: "Tasarım 15mm altında — die-cut hassasiyet riski",
      autoFixable: false,
    });
  }

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

function countSharpCorners(svgPath: string, minRadiusMm: number): number {
  void minRadiusMm;
  void svgPath;
  return 0;
}
