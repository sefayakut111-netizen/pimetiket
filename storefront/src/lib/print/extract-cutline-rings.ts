import type { PathRing } from "@/lib/editor/cutline/types";

type Pt = { x: number; y: number };

const ARC_SAMPLES = 8;

function vecAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const denom = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (denom === 0) return 0;
  return sign * Math.acos(Math.max(-1, Math.min(1, dot / denom)));
}

/** SVG elliptical arc (endpoint parametrization) → örneklenmiş noktalar (başlangıç hariç). */
function sampleSvgEllipticalArc(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  phiDeg: number,
  largeArc: number,
  sweep: number,
  x1: number,
  y1: number
): Pt[] {
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx === 0 || ry === 0) {
    return [{ x: x1, y: y1 }];
  }

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);

  const dx2 = (x0 - x1) / 2;
  const dy2 = (y0 - y1) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda =
    (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxAbs *= s;
    ryAbs *= s;
  }

  const sign = largeArc !== sweep ? 1 : -1;
  const sq = Math.max(
    0,
    (rxAbs * rxAbs * ryAbs * ryAbs -
      rxAbs * rxAbs * y1p * y1p -
      ryAbs * ryAbs * x1p * x1p) /
      (rxAbs * rxAbs * y1p * y1p + ryAbs * ryAbs * x1p * x1p)
  );
  const coef = sign * Math.sqrt(sq);
  const cxp = coef * ((rxAbs * y1p) / ryAbs);
  const cyp = coef * (-(ryAbs * x1p) / rxAbs);

  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

  const theta1 = vecAngle(1, 0, (x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs);
  let dTheta = vecAngle(
    (x1p - cxp) / rxAbs,
    (y1p - cyp) / ryAbs,
    (-x1p - cxp) / rxAbs,
    (-y1p - cyp) / ryAbs
  );

  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  const out: Pt[] = [];
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const theta = theta1 + (dTheta * i) / ARC_SAMPLES;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    out.push({
      x: cx + rxAbs * cosT * cosPhi - ryAbs * sinT * sinPhi,
      y: cy + rxAbs * cosT * sinPhi + ryAbs * sinT * cosPhi,
    });
  }
  return out;
}

/** SVG path d → nokta listesi (M/L/H/V/C/A/Z; arc örneklenir). */
function parseSvgPathToPoints(d: string): Pt[] {
  const tokens =
    d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map((t) => t.trim()) ??
    [];
  const points: Pt[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let cmd = "";

  const readNum = () => parseFloat(tokens[i++] ?? "0");

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }

    switch (cmd) {
      case "M":
      case "m": {
        const x = readNum();
        const y = readNum();
        cx = cmd === "m" ? cx + x : x;
        cy = cmd === "m" ? cy + y : y;
        points.push({ x: cx, y: cy });
        cmd = cmd === "m" ? "l" : "L";
        break;
      }
      case "L":
      case "l": {
        const x = readNum();
        const y = readNum();
        cx = cmd === "l" ? cx + x : x;
        cy = cmd === "l" ? cy + y : y;
        points.push({ x: cx, y: cy });
        break;
      }
      case "H":
      case "h": {
        const x = readNum();
        cx = cmd === "h" ? cx + x : x;
        points.push({ x: cx, y: cy });
        break;
      }
      case "V":
      case "v": {
        const y = readNum();
        cy = cmd === "v" ? cy + y : y;
        points.push({ x: cx, y: cy });
        break;
      }
      case "C":
      case "c": {
        readNum();
        readNum();
        readNum();
        readNum();
        const x = readNum();
        const y = readNum();
        cx = cmd === "c" ? cx + x : x;
        cy = cmd === "c" ? cy + y : y;
        points.push({ x: cx, y: cy });
        break;
      }
      case "A":
      case "a": {
        const rx = readNum();
        const ry = readNum();
        const phi = readNum();
        const fA = readNum();
        const fS = readNum();
        const x = readNum();
        const y = readNum();
        const endX = cmd === "a" ? cx + x : x;
        const endY = cmd === "a" ? cy + y : y;
        const arcPts = sampleSvgEllipticalArc(
          cx,
          cy,
          rx,
          ry,
          phi,
          fA,
          fS,
          endX,
          endY
        );
        for (const p of arcPts) points.push(p);
        cx = endX;
        cy = endY;
        break;
      }
      case "Z":
      case "z":
        if (points.length > 0) points.push({ ...points[0]! });
        break;
      default:
        if (/^-?\d/.test(t)) i++;
        else i++;
    }
  }
  return points;
}

function parseSvgDimAttr(raw: string): number | null {
  const n = parseFloat(raw.replace(/mm$/i, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSvgViewFrame(
  svgText: string,
  labelWidthMm: number,
  labelHeightMm: number
): {
  minX: number;
  minY: number;
  vbW: number;
  vbH: number;
  widthMm: number;
  heightMm: number;
} {
  let widthMm = labelWidthMm;
  let heightMm = labelHeightMm;

  const wMatch = svgText.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const hMatch = svgText.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const wAttr = wMatch ? parseSvgDimAttr(wMatch[1]) : null;
  const hAttr = hMatch ? parseSvgDimAttr(hMatch[1]) : null;
  if (wMatch?.[1]?.toLowerCase().includes("mm") && wAttr != null) {
    widthMm = wAttr;
  }
  if (hMatch?.[1]?.toLowerCase().includes("mm") && hAttr != null) {
    heightMm = hAttr;
  }

  const vbMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vbMatch) {
    const parts = vbMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((s) => parseFloat(s));
    if (
      parts.length >= 4 &&
      parts.every((n) => Number.isFinite(n)) &&
      (parts[2] ?? 0) > 0 &&
      (parts[3] ?? 0) > 0
    ) {
      return {
        minX: parts[0]!,
        minY: parts[1]!,
        vbW: parts[2]!,
        vbH: parts[3]!,
        widthMm,
        heightMm,
      };
    }
  }

  if (wAttr != null && hAttr != null && !wMatch?.[1]?.toLowerCase().includes("mm")) {
    return {
      minX: 0,
      minY: 0,
      vbW: wAttr,
      vbH: hAttr,
      widthMm,
      heightMm,
    };
  }

  return {
    minX: 0,
    minY: 0,
    vbW: widthMm,
    vbH: heightMm,
    widthMm,
    heightMm,
  };
}

function ringBounds(rings: PathRing[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * poc px viewBox + mm attrib → label mm uzayına normalize.
 * buildCutlineSvgMm (viewBox zaten mm) için bbox ≈ label → minimal düzeltme.
 */
function normalizeRingsToLabelMm(
  rings: PathRing[],
  labelWidthMm: number,
  labelHeightMm: number
): PathRing[] {
  if (rings.length === 0) return rings;

  const { minX, minY, maxX, maxY } = ringBounds(rings);
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw <= 0 || bh <= 0) return rings;

  const alreadyMm =
    minX >= -0.5 &&
    minY >= -0.5 &&
    Math.abs(bw - labelWidthMm) / labelWidthMm < 0.03 &&
    Math.abs(bh - labelHeightMm) / labelHeightMm < 0.03;

  if (alreadyMm) return rings;

  const sx = labelWidthMm / bw;
  const sy = labelHeightMm / bh;

  return rings.map((ring) =>
    ring.map(([x, y]) => [(x - minX) * sx, (y - minY) * sy])
  );
}

function extractSvgPathDs(svgText: string): string[] {
  const matches = [...svgText.matchAll(/\bd=["']([^"']+)["']/gi)];
  return matches.map((m) => m[1]!);
}

/** cutline_designs / poc SVG → mm PathRing[] */
export function extractCutlineRingsFromSvg(
  svgText: string,
  labelWidthMm: number,
  labelHeightMm: number
): PathRing[] {
  const frame = parseSvgViewFrame(svgText, labelWidthMm, labelHeightMm);
  const ringsUser: PathRing[] = [];

  for (const d of extractSvgPathDs(svgText)) {
    const pts = parseSvgPathToPoints(d);
    if (pts.length < 2) continue;
    const ring: PathRing = pts.map((p) => [
      (p.x - frame.minX) * (labelWidthMm / frame.vbW),
      (p.y - frame.minY) * (labelHeightMm / frame.vbH),
    ]);
    ringsUser.push(ring);
  }

  return normalizeRingsToLabelMm(ringsUser, labelWidthMm, labelHeightMm);
}
