import { describe, expect, it } from "vitest";
import { computeGeometry } from "@/lib/pricing-engine/geometry";
import {
  DIECUT_EN,
  ROLL_W_MAX,
  ROLL_W_MIN,
} from "@/lib/pricing-engine/constants";
import {
  resolveStickerGeomCut,
  resolveStickerQuoteDimensions,
} from "@/lib/sticker-customer-pricing";

describe("die-cut geometry invariant", () => {
  const cases = [
    { width: 75, height: 75, qty: 25, cut: "diecut" as const },
    { width: 60, height: 60, qty: 50, cut: "kisscut" as const },
    { width: 75, height: 75, qty: 25, cut: "kartli" as const },
  ];

  for (const c of cases) {
    it(`${c.cut} ${c.width}×${c.height}×${c.qty}`, () => {
      const { geomWidth, geomHeight } = resolveStickerQuoteDimensions({
        width: c.width,
        height: c.height,
        material: "vinil",
        finish: "parlak",
        qty: c.qty,
        cut: c.cut,
      });
      const engineCut = resolveStickerGeomCut(c.cut);
      const g = computeGeometry({
        width: geomWidth,
        height: geomHeight,
        cut: engineCut,
        qty: c.qty,
      });
      expect(g).not.toBeNull();
      if (!g) return;

      expect(g.roll.rollW).toBe(DIECUT_EN);

      const segmentHeights = g.roll.segmentHeights ?? [];
      expect(segmentHeights.length).toBeGreaterThan(0);
      for (const h of segmentHeights) {
        expect(h).toBeGreaterThanOrEqual(ROLL_W_MIN);
        expect(h).toBeLessThanOrEqual(ROLL_W_MAX);
      }

      const sumSegments = segmentHeights.reduce((a, b) => a + b, 0);
      expect(g.roll.totalArea).toBeCloseTo(DIECUT_EN * sumSegments, 6);
      expect(g.roll.totalArea).toBeCloseTo(DIECUT_EN * g.roll.totalLengthMm, 6);
    });
  }
});
