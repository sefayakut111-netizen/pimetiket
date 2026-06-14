import { describe, expect, it } from "vitest";
import { computeGeometry } from "@/lib/pricing-engine/geometry";
import { OVERAGE_TARGET_MAX } from "@/lib/pricing-engine/constants";
import {
  resolveStickerGeomCut,
  resolveStickerQuoteDimensions,
} from "@/lib/sticker-customer-pricing";

describe("tabaka geometry", () => {
  it("outer ≤ 230×310, overage ≤ 10%", () => {
    const cases = [
      { width: 50, height: 50, qty: 100 },
      { width: 100, height: 150, qty: 250 },
    ];

    for (const c of cases) {
      const { geomWidth, geomHeight } = resolveStickerQuoteDimensions({
        width: c.width,
        height: c.height,
        material: "vinil",
        finish: "parlak",
        qty: c.qty,
        cut: "tabaka",
      });
      const g = computeGeometry({
        width: geomWidth,
        height: geomHeight,
        cut: resolveStickerGeomCut("tabaka"),
        qty: c.qty,
      });
      expect(g).not.toBeNull();
      if (!g) continue;

      expect(g.fit.mode).toBe("tabaka");
      expect(g.fit.sheetW).toBeLessThanOrEqual(230 + 1e-9);
      expect(g.fit.sheetH).toBeLessThanOrEqual(310 + 1e-9);
      expect(g.fit.overrun).toBeLessThanOrEqual(OVERAGE_TARGET_MAX + 0.001);
      expect(g.sheetAreaM2).toBeGreaterThan(0);
    }
  });
});
