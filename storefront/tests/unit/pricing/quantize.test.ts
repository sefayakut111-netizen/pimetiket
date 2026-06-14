import { describe, expect, it } from "vitest";
import { quantizeForCart } from "@/lib/pricing-quantize";

describe("quantizeForCart (#13 ≤0.005₺/birim)", () => {
  it("unit×qty = total (kart tutarlılık)", () => {
    const { unit, total } = quantizeForCart(3.6438, 300);
    expect(unit).toBe(3.64);
    expect(total).toBe(1092);
    expect(unit * 300).toBe(total);
  });

  it("documented example: unit×qty = total", () => {
    const { unit, total } = quantizeForCart(3.6438, 300);
    expect(unit).toBe(3.64);
    expect(total).toBe(1092);
    expect(Math.abs(unit - 3.6438)).toBeLessThanOrEqual(0.005);
  });

  it("non-finite → zero", () => {
    expect(quantizeForCart(NaN, 10)).toEqual({ unit: 0, total: 0 });
  });
});
