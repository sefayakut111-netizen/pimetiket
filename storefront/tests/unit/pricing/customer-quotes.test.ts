import { describe, expect, it } from "vitest";
import { quoteCustomerSticker } from "@/lib/sticker-customer-pricing";
import { quoteCustomerEtiket } from "@/lib/etiket-customer-pricing";

describe("quoteCustomerSticker", () => {
  it("diecut vinil 75×75×25", () => {
    const r = quoteCustomerSticker({
      width: 75,
      height: 75,
      qty: 25,
      material: "vinil",
      finish: "parlak",
      cut: "diecut",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBeGreaterThan(0);
    expect(r.unitPrice).toBeGreaterThan(0);
    expect(r.geometry.perSheet).toBeGreaterThan(0);
  });

  it("pageMode A4", () => {
    const r = quoteCustomerSticker({
      width: 210,
      height: 297,
      qty: 25,
      material: "vinil",
      finish: "yok",
      cut: "tabaka",
      pageMode: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.geometry.sheetsNeeded).toBe(25);
  });
});

describe("quoteCustomerEtiket", () => {
  it("rulo kuse 40×40×1000", () => {
    const r = quoteCustomerEtiket({
      width: 40,
      height: 40,
      qty: 1000,
      material: "kuse",
      coating: "yok",
      customization: "yok",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBeGreaterThan(0);
    expect(r.rollsNeeded).toBeGreaterThan(0);
  });
});
