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

function parsePathPoints(d: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const segments = d.match(/[MLml][^MLmlZz]*/g) ?? [];
  let cx = 0;
  let cy = 0;

  for (const seg of segments) {
    const cmd = seg[0];
    const isRelative = cmd === cmd.toLowerCase();
    const nums = seg
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n));

    if ((cmd === "M" || cmd === "m") && nums.length >= 2) {
      cx = isRelative ? cx + nums[0] : nums[0];
      cy = isRelative ? cy + nums[1] : nums[1];
      points.push({ x: cx, y: cy });
    } else if ((cmd === "L" || cmd === "l") && nums.length >= 2) {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cx = isRelative ? cx + nums[i] : nums[i];
        cy = isRelative ? cy + nums[i + 1] : nums[i + 1];
        points.push({ x: cx, y: cy });
      }
    }
  }
  return points;
}

function interiorAngleDeg(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function countSharpCorners(svgPath: string, minRadiusMm: number): number {
  void minRadiusMm;
  const pathDs = svgPath.includes("<path")
    ? [...svgPath.matchAll(/\bd=["']([^"']+)["']/gi)].map((m) => m[1])
    : [svgPath];

  let sharp = 0;
  for (const d of pathDs) {
    const pts = parsePathPoints(d);
    if (pts.length < 3) continue;
    for (let i = 1; i < pts.length - 1; i++) {
      const ang = interiorAngleDeg(pts[i - 1], pts[i], pts[i + 1]);
      if (ang < 90) sharp++;
    }
  }
  return sharp;
}
