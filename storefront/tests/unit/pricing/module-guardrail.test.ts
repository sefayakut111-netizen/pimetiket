import { describe, expect, it } from "vitest";
import { quoteStickerFromConfig } from "@/lib/customer-pricing-from-config";
import { FALLBACK_STICKER_CONFIG } from "@/lib/pricing-config-types";

const SHARED = {
  width: 75,
  height: 75,
  qty: 25,
  finish: "parlak" as const,
  cut: "diecut" as const,
};

describe("module guardrail — aynı W×H×qty, farklı malzeme → farklı fiyat", () => {
  it("vinil vs holo vs transparan produce 3 distinct totals", () => {
    const vinil = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
      ...SHARED,
      material: "vinil",
    });
    const holo = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
      ...SHARED,
      material: "holo",
    });
    const transparan = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
      ...SHARED,
      material: "transparan",
    });

    expect(vinil?.ok).toBe(true);
    expect(holo?.ok).toBe(true);
    expect(transparan?.ok).toBe(true);
    if (!vinil?.ok || !holo?.ok || !transparan?.ok) return;

    const totals = [vinil.total, holo.total, transparan.total];
    expect(new Set(totals).size).toBe(3);
    expect(holo.total).toBeGreaterThan(vinil.total);
    expect(transparan.total).toBeGreaterThan(vinil.total);
  });
});
