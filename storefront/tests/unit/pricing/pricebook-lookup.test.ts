import { describe, expect, it } from "vitest";
import { lookupPricebookFromSnapshot } from "@/lib/pricing-pricebook-lookup";
import { PRICEBOOK_MIN_QTY } from "@/lib/pricing-pricebook-types";
import { MINI_PRICEbook_SNAPSHOT } from "./_fixtures/pricebook-snapshot";

describe("lookupPricebookFromSnapshot", () => {
  it("bilinear interpolation mid-cell", () => {
    const r = lookupPricebookFromSnapshot(MINI_PRICEbook_SNAPSHOT, {
      width_mm: 40,
      height_mm: 40,
      qty: 1500,
      material_key: "kuse",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.partner_unit_per_label).toBeGreaterThan(0.09);
    expect(r.partner_unit_per_label).toBeLessThan(0.13);
    expect(r.partner_subtotal).toBeCloseTo(
      r.partner_unit_per_label * 1500,
      4
    );
  });

  it("qty_below_min", () => {
    const r = lookupPricebookFromSnapshot(MINI_PRICEbook_SNAPSHOT, {
      width_mm: 40,
      height_mm: 40,
      qty: 500,
      material_key: "kuse",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("qty_below_min");
    expect(r.min_qty).toBe(PRICEBOOK_MIN_QTY);
  });

  it("size_above_max", () => {
    const r = lookupPricebookFromSnapshot(MINI_PRICEbook_SNAPSHOT, {
      width_mm: 200,
      height_mm: 200,
      qty: 1000,
      material_key: "kuse",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("size_above_max");
  });

  it("material_not_found", () => {
    const r = lookupPricebookFromSnapshot(MINI_PRICEbook_SNAPSHOT, {
      width_mm: 40,
      height_mm: 40,
      qty: 1000,
      material_key: "unknown",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("material_not_found");
  });

  it("matrix_inactive", () => {
    const r = lookupPricebookFromSnapshot(MINI_PRICEbook_SNAPSHOT, {
      width_mm: 30,
      height_mm: 30,
      qty: 1000,
      material_key: "inactive_mat",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("matrix_inactive");
  });
});
