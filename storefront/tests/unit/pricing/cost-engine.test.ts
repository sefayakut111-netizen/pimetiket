import { describe, expect, it } from "vitest";
import { computeCost } from "@/lib/pricing-engine/cost";
import { computeGeometry } from "@/lib/pricing-engine/geometry";
import { STICKER_TIERS } from "@/lib/pricing-engine/constants";
import { getDefaultInput } from "@/lib/pricing-profiles";

describe("computeCost", () => {
  it("fee gross-up + VAT on engine path", () => {
    const g = computeGeometry({
      width: 75,
      height: 75,
      cut: "diecut",
      qty: 25,
    });
    expect(g).not.toBeNull();
    if (!g) return;

    const defaults = getDefaultInput();
    const tier = STICKER_TIERS.find((t) => t.qty === 25) ?? STICKER_TIERS[0];

    const result = computeCost({
      geometry: g,
      requestedQty: 25,
      production: { mode: "fason", rate: defaults.fasonRate },
      operation: {
        setup: defaults.setup,
        packaging: defaults.packaging,
        feePct: defaults.feePct,
      },
      margin: { marginPct: 50, vatPct: defaults.vatPct },
      tier,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.unitPrice).toBe(result.total / 25);
    expect(result.processingFee).toBeGreaterThan(0);
    expect(result.subtotal).toBeGreaterThan(result.preTierSubtotal);
    expect(result.vatAmount).toBeCloseTo(
      result.subtotal * (defaults.vatPct / 100),
      4
    );
    expect(result.total).toBeCloseTo(result.subtotal + result.vatAmount, 4);
  });
});
