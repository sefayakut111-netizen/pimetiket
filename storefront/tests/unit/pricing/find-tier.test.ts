import { describe, expect, it } from "vitest";
import { findEtiketTier } from "@/lib/pricing-engine/etiket-pricing";

describe("findEtiketTier (nearest qty)", () => {
  // KNOWN ISSUE: nearest-tier non-monotonic band around 3500 (düzeltilince güncellenir)
  it("KNOWN ISSUE: 3499 → ×1.05 (2000 tier)", () => {
    expect(findEtiketTier(3499).multiplier).toBe(1.05);
  });

  it("KNOWN ISSUE: 3500 → ×1.05 (2000 tier — tie with 5000)", () => {
    expect(findEtiketTier(3500).multiplier).toBe(1.05);
  });

  it("KNOWN ISSUE: 3501 → ×1.00 (5000 tier)", () => {
    expect(findEtiketTier(3501).multiplier).toBe(1);
  });

  it("exact tier match", () => {
    expect(findEtiketTier(5000).multiplier).toBe(1);
    expect(findEtiketTier(5000).qty).toBe(5000);
  });
});
