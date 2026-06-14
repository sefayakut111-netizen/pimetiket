import { describe, expect, it } from "vitest";
import { quoteStickerFromConfig } from "@/lib/customer-pricing-from-config";
import { FALLBACK_STICKER_CONFIG } from "@/lib/pricing-config-types";
import { expectedCartLineFromPerDesignQuote } from "@/lib/design-count-pricing";
import { computeRollPlan } from "@/lib/pricing-engine/geometry";
import {
  expectWithinAbs,
  expectWithinBand,
  expectWithinPct,
} from "../_helpers/tolerance";

const HOLO_CASE = {
  width: 70,
  height: 70,
  qty: 25,
  material: "holo" as const,
  finish: "parlak" as const,
  cut: "diecut" as const,
};

const LEGACY_WRONG_TOTAL = 1250;
const LIVE_EXPECTED_TOTAL = 722;
/** quoteStickerFromConfig + FALLBACK_STICKER_CONFIG zinciri (canlı 2026-06-14) */
const KARTLI_BASELINE_TOTAL = 490.8461538461538;
const PAGE_A4_BILLABLE_M2 = 1.97901;
const PAGE_A4_BASELINE_TOTAL = 2120.016553846154;

describe("regression baselines (runner parity)", () => {
  it("kartlı 75×75×25 — runner zinciri total", () => {
    const q = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
      width: 75,
      height: 75,
      qty: 25,
      material: "vinil",
      finish: "parlak",
      cut: "kartli",
    });
    expect(q?.ok).toBe(true);
    if (!q?.ok) return;
    expectWithinAbs(q.total, KARTLI_BASELINE_TOTAL, 0.5);
  });

  it("holo 70×70×25 → ~722 via cart line (≠1250)", () => {
    const q = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, HOLO_CASE);
    expect(q?.ok).toBe(true);
    if (!q?.ok) return;
    const line = expectedCartLineFromPerDesignQuote(q.unitPrice, 25, 1);
    expectWithinPct(line.total, LIVE_EXPECTED_TOTAL, 0.05);
    expect(Math.abs(line.total - LEGACY_WRONG_TOTAL)).toBeGreaterThan(100);
  });

  it("pageMode A4 210×297×25 — billable + total (runner zinciri)", () => {
    const rollPlan = computeRollPlan(210, 297, 25);
    expect(rollPlan).not.toBeNull();
    if (!rollPlan) return;
    const billableM2 = rollPlan.totalArea / 1_000_000;
    expectWithinAbs(billableM2, PAGE_A4_BILLABLE_M2, 0.002);

    const q = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
      width: 210,
      height: 297,
      qty: 25,
      material: "vinil",
      finish: "yok",
      cut: "tabaka",
      pageMode: true,
    });
    expect(q?.ok).toBe(true);
    if (!q?.ok) return;
    expectWithinAbs(q.total, PAGE_A4_BASELINE_TOTAL, 0.5);
  });

  it("recalc parity: cartLine.total ≈ quote.total", () => {
    for (const cut of ["kartli", "diecut", "kisscut", "tabaka"] as const) {
      const input = {
        width: cut === "kisscut" ? 60 : 75,
        height: cut === "kisscut" ? 60 : 75,
        qty: cut === "kisscut" ? 50 : cut === "tabaka" ? 100 : 25,
        material: "vinil" as const,
        finish: "parlak" as const,
        cut,
      };
      const q = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, input);
      expect(q?.ok).toBe(true);
      if (!q?.ok) continue;
      const line = expectedCartLineFromPerDesignQuote(
        q.unitPrice,
        input.qty,
        1
      );
      expectWithinBand(line.total, q.total, 0.02);
    }
  });

  it("pageMode meta recalc parity (runner zinciri)", () => {
    const q = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
      width: 210,
      height: 297,
      qty: 25,
      material: "vinil",
      finish: "yok",
      cut: "tabaka",
      pageMode: true,
    });
    expect(q?.ok).toBe(true);
    if (!q?.ok) return;
    const line = expectedCartLineFromPerDesignQuote(q.unitPrice, 25, 1);
    expectWithinAbs(line.total, PAGE_A4_BASELINE_TOTAL, 0.5);
  });
});
