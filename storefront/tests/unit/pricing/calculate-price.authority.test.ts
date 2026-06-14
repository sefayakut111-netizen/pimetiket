import { describe, expect, it } from "vitest";
import { calculatePrice, findTier } from "@/lib/pricing-calc";
import {
  FALLBACK_STICKER_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
  FALLBACK_ETIKET_RULO_CONFIG,
} from "@/lib/pricing-config-types";

describe("findTier (ceiling qty<=t.qty)", () => {
  const tiers = FALLBACK_STICKER_CONFIG.tiers;

  it("qty=25 → first tier", () => {
    expect(findTier(25, tiers).qty).toBe(25);
    expect(findTier(25, tiers).multiplier).toBe(1.3);
  });

  it("qty=300 → tier 500", () => {
    expect(findTier(300, tiers).qty).toBe(500);
    expect(findTier(300, tiers).multiplier).toBe(0.9);
  });

  it("qty above max tier uses last tier", () => {
    expect(findTier(5000, tiers).qty).toBe(1000);
    expect(findTier(5000, tiers).multiplier).toBe(0.8);
  });
});

describe("calculatePrice — dual-price sticker scope", () => {
  it("sticker area mode with billable_m2", () => {
    const r = calculatePrice(
      {
        width_mm: 75,
        height_mm: 75,
        qty: 25,
        material_id: "vinil",
        selected_options: { finish: "parlak" },
        billable_m2: 0.15,
        cut_type: "diecut",
      },
      FALLBACK_STICKER_CONFIG,
      "sticker"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.final).toBeGreaterThan(0);
    expect(r.with_fee).toBeGreaterThan(r.with_margin);
    expect(r.total_with_vat).toBe(r.final);
    expect(r.unit_price).toBe(r.final / 25);
  });

  it("etiket_tabaka sheet mode", () => {
    const r = calculatePrice(
      {
        width_mm: 50,
        height_mm: 50,
        qty: 250,
        material_id: "kuse",
        selected_options: { coating: "yok" },
        sheets_needed: 10,
      },
      FALLBACK_ETIKET_TABAKA_CONFIG,
      "etiket_tabaka"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pricing_mode).toBe("sheet");
    expect(r.sheets_used).toBe(10);
    expect(r.final).toBeGreaterThan(0);
  });

  it("fail: material_not_found", () => {
    const r = calculatePrice(
      {
        width_mm: 50,
        height_mm: 50,
        qty: 25,
        material_id: "nonexistent",
        selected_options: { finish: "parlak" },
        billable_m2: 0.1,
      },
      FALLBACK_STICKER_CONFIG,
      "sticker"
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("material_not_found");
  });

  it("fail: invalid_size", () => {
    const r = calculatePrice(
      {
        width_mm: 0,
        height_mm: 50,
        qty: 25,
        material_id: "vinil",
        selected_options: { finish: "parlak" },
        billable_m2: 0.1,
      },
      FALLBACK_STICKER_CONFIG,
      "sticker"
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_size");
  });

  it("fail: invalid_qty", () => {
    const r = calculatePrice(
      {
        width_mm: 50,
        height_mm: 50,
        qty: 0,
        material_id: "vinil",
        selected_options: { finish: "parlak" },
        billable_m2: 0.1,
      },
      FALLBACK_STICKER_CONFIG,
      "sticker"
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_qty");
  });
});

describe("calculatePrice — legacy etiket_rulo (area + margin)", () => {
  it("legacy path with margin and fee gross-up", () => {
    const r = calculatePrice(
      {
        width_mm: 40,
        height_mm: 40,
        qty: 1000,
        material_id: "kuse",
        selected_options: { coating: "yok", customization: "yok" },
        billable_m2: 2.5,
      },
      FALLBACK_ETIKET_RULO_CONFIG,
      "etiket_rulo"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.with_margin).toBeGreaterThan(r.cost_total);
    expect(r.final).toBeGreaterThan(r.with_fee);
  });
});
