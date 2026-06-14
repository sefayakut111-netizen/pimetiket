import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/lib/pricing-calc";
import { FALLBACK_STICKER_CONFIG } from "@/lib/pricing-config-types";

const INPUT = {
  width_mm: 75,
  height_mm: 75,
  qty: 25,
  material_id: "vinil",
  selected_options: { finish: "parlak" },
  billable_m2: 0.18,
  cut_type: "diecut" as const,
};

describe("fee gross-up + KDV", () => {
  it("gross-up fee then VAT on sticker dual-price", () => {
    const r = calculatePrice(INPUT, FALLBACK_STICKER_CONFIG, "sticker");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const fee_pct = FALLBACK_STICKER_CONFIG.operation.fee_pct;
    const vat_pct = FALLBACK_STICKER_CONFIG.vat.pct;
    const sell_before_fee = r.with_options + r.operation_cost;
    const expectedWithFee = sell_before_fee / (1 - fee_pct / 100);
    const expectedFinal = expectedWithFee * (1 + vat_pct / 100);

    expect(r.with_fee).toBeCloseTo(expectedWithFee, 4);
    expect(r.final).toBeCloseTo(expectedFinal, 4);
    expect(r.total_with_vat).toBeCloseTo(expectedFinal, 4);
  });

  it("fee_pct=0 → no gross-up", () => {
    const cfg = {
      ...FALLBACK_STICKER_CONFIG,
      operation: { ...FALLBACK_STICKER_CONFIG.operation, fee_pct: 0 },
    };
    const r = calculatePrice(INPUT, cfg, "sticker");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const sell_before_fee = r.with_options + r.operation_cost;
    expect(r.with_fee).toBeCloseTo(sell_before_fee, 4);
    expect(r.final).toBeCloseTo(
      sell_before_fee * (1 + cfg.vat.pct / 100),
      4
    );
  });
});
