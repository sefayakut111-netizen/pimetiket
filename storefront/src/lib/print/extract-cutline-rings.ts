import type { PathRing } from "@/lib/editor/cutline/types";

type Pt = { x: number; y: number };

/** SVG path d → nokta listesi (M/L/H/V/C/Z; arc C benzeri örnekleme). */
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
        readNum();
        readNum();
        readNum();
        readNum();
        readNum();
        const x = readNum();
        const y = readNum();
        cx = cmd === "a" ? cx + x : x;
        cy = cmd === "a" ? cy + y : y;
        points.push({ x: cx, y: cy });
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
): { minX: number; minY: number; vbW: number; vbH: number } {
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
      };
    }
  }

  const wMatch = svgText.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const hMatch = svgText.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const w = wMatch ? parseSvgDimAttr(wMatch[1]) : null;
  const h = hMatch ? parseSvgDimAttr(hMatch[1]) : null;
  if (w != null && h != null) {
    return { minX: 0, minY: 0, vbW: w, vbH: h };
  }

  return { minX: 0, minY: 0, vbW: labelWidthMm, vbH: labelHeightMm };
}

function svgPointToLabelMm(
  px: number,
  py: number,
  frame: { minX: number; minY: number; vbW: number; vbH: number },
  labelWidthMm: number,
  labelHeightMm: number
): [number, number] {
  return [
    (px - frame.minX) * (labelWidthMm / frame.vbW),
    (py - frame.minY) * (labelHeightMm / frame.vbH),
  ];
}

function extractSvgPathDs(svgText: string): string[] {
  const matches = [...svgText.matchAll(/\bd=["']([^"']+)["']/gi)];
  return matches.map((m) => m[1]!);
}

/** cutline_designs SVG → mm PathRing[] (buildCutlineSvgMm viewBox sözleşmesi). */
export function extractCutlineRingsFromSvg(
  svgText: string,
  labelWidthMm: number,
  labelHeightMm: number
): PathRing[] {
  const frame = parseSvgViewFrame(svgText, labelWidthMm, labelHeightMm);
  const rings: PathRing[] = [];

  for (const d of extractSvgPathDs(svgText)) {
    const pts = parseSvgPathToPoints(d);
    if (pts.length < 2) continue;
    const ring: PathRing = pts.map((p) =>
      svgPointToLabelMm(p.x, p.y, frame, labelWidthMm, labelHeightMm)
    );
    rings.push(ring);
  }

  return rings;
}
