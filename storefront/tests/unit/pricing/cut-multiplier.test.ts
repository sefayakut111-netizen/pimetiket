import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/lib/pricing-calc";
import { FALLBACK_STICKER_CONFIG } from "@/lib/pricing-config-types";

const BASE_INPUT = {
  width_mm: 75,
  height_mm: 75,
  qty: 25,
  material_id: "vinil",
  selected_options: { finish: "mat" },
  billable_m2: 0.2,
};

describe("cut multiplier — toplamsal (dual-price sticker)", () => {
  function stickerWithCut(cut_type: "diecut" | "kisscut" | "kartli") {
    const r = calculatePrice(
      { ...BASE_INPUT, cut_type },
      FALLBACK_STICKER_CONFIG,
      "sticker"
    );
    expect(r.ok).toBe(true);
    return r;
  }

  it("diecut + mat finish: toplamsal ≠ çarpımsal (opt% + cutAdd)", () => {
    const diecut = stickerWithCut("diecut");
    if (!diecut.ok) return;

    const tiered = diecut.tiered;
    const optPct = diecut.options_pct_total;
    const cutAdd = 0.1;
    const toplamsal = tiered * (1 + optPct / 100 + cutAdd);
    expect(diecut.with_options).toBeCloseTo(toplamsal, 4);

    const multiplicativeWrong =
      tiered * (1 + optPct / 100) * (1 + cutAdd);
    expect(diecut.with_options).not.toBeCloseTo(multiplicativeWrong, 3);
  });

  it("kisscut cut_mult=1.00", () => {
    const r = stickerWithCut("kisscut");
    if (!r.ok) return;
    const base = calculatePrice(
      { ...BASE_INPUT, cut_type: "diecut" },
      {
        ...FALLBACK_STICKER_CONFIG,
        cut_multipliers: { diecut: 1, kisscut: 1, tabaka: 1 },
      },
      "sticker"
    );
    if (!base.ok) return;
    expect(r.with_options).toBeCloseTo(base.with_options, 4);
  });

  it("kartli maps to diecut multiplier (eşit fiyat)", () => {
    const kartli = stickerWithCut("kartli");
    const diecut = stickerWithCut("diecut");
    if (!kartli.ok || !diecut.ok) return;
    expect(kartli.with_options).toBeCloseTo(diecut.with_options, 4);
  });
});
