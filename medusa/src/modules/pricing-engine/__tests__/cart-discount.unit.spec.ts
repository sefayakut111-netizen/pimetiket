/**
 * Pricing engine — sepet grup indirimi testleri.
 *
 * Kaynak: docs/PRICING_SPEC.md §6
 *
 * Senaryolar:
 *   - Boş sepet → 0 / 0 / 0
 *   - 1 tasarım (yalnız) → indirim 0
 *   - 2 aynı boyut → -%3 her birine
 *   - 3 aynı boyut → -%5
 *   - 6+ aynı boyut → -%8
 *   - 10+ aynı boyut → -%10 (max, daha artmaz)
 *   - 15 aynı boyut → -%10 (cap)
 *   - Karışık: 6 × 50×50 + 3 × 70×70 + 2 × 100×100 + 1 × 25×80
 *     → 4 grup, ayrı oranlar
 *   - Toplam indirim doğrulama
 */

import { computeCart, getGroupDiscount } from "../lib/cart-discount";
import type { CartLineInput } from "../lib/cart-discount";

const lineId = (n: number) => `line-${n}`;

function makeLine(
  n: number,
  width: number,
  height: number,
  preGroupTotal: number,
  qty = 250
): CartLineInput {
  return {
    id: lineId(n),
    width,
    height,
    requestedQty: qty,
    preGroupTotal,
  };
}

describe("getGroupDiscount", () => {
  test("1 → 0", () => expect(getGroupDiscount(1)).toBe(0));
  test("2 → 0.03", () => expect(getGroupDiscount(2)).toBe(0.03));
  test("3 → 0.05", () => expect(getGroupDiscount(3)).toBe(0.05));
  test("5 → 0.05", () => expect(getGroupDiscount(5)).toBe(0.05));
  test("6 → 0.08", () => expect(getGroupDiscount(6)).toBe(0.08));
  test("9 → 0.08", () => expect(getGroupDiscount(9)).toBe(0.08));
  test("10 → 0.10", () => expect(getGroupDiscount(10)).toBe(0.10));
  test("100 → 0.10 (cap)", () => expect(getGroupDiscount(100)).toBe(0.10));
});

describe("computeCart — boş ve tek line", () => {
  test("boş sepet", () => {
    const result = computeCart([]);
    expect(result.items).toEqual([]);
    expect(result.subtotal).toBe(0);
    expect(result.groupDiscountTotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.totalStickers).toBe(0);
  });

  test("1 tasarım → indirim 0, finalTotal = preGroupTotal", () => {
    const result = computeCart([makeLine(1, 50, 50, 1000)]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].groupDiscountPct).toBe(0);
    expect(result.items[0].finalTotal).toBe(1000);
    expect(result.total).toBe(1000);
  });
});

describe("computeCart — aynı boyut grubu indirimi", () => {
  test("2 aynı boyut (50×50) → her ikisi -%3", () => {
    const lines = [
      makeLine(1, 50, 50, 1000),
      makeLine(2, 50, 50, 1000),
    ];
    const result = computeCart(lines);

    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.03);
      expect(item.groupDiscountAmount).toBe(30);
      expect(item.finalTotal).toBe(970);
    }
    expect(result.subtotal).toBe(2000);
    expect(result.groupDiscountTotal).toBe(60);
    expect(result.total).toBe(1940);
  });

  test("6 aynı boyut → her birine -%8", () => {
    const lines = Array.from({ length: 6 }, (_, i) =>
      makeLine(i, 50, 50, 1000)
    );
    const result = computeCart(lines);

    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.08);
      expect(item.finalTotal).toBe(920);
    }
    expect(result.total).toBe(5520);
  });

  test("10 aynı boyut → -%10", () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      makeLine(i, 50, 50, 1000)
    );
    const result = computeCart(lines);

    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.10);
      expect(item.finalTotal).toBe(900);
    }
    expect(result.total).toBe(9000);
  });

  test("15 aynı boyut → -%10 cap, daha artmaz", () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      makeLine(i, 50, 50, 1000)
    );
    const result = computeCart(lines);

    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.10);
    }
    expect(result.total).toBe(13500);
  });
});

describe("computeCart — karışık gruplar", () => {
  test("4 farklı boyut grubu, ayrı oranlar", () => {
    const lines = [
      // 50×50 grubu — 6 tasarım → -%8
      ...Array.from({ length: 6 }, (_, i) => makeLine(i, 50, 50, 1000)),
      // 70×70 grubu — 3 tasarım → -%5
      ...Array.from({ length: 3 }, (_, i) => makeLine(i + 100, 70, 70, 2000)),
      // 100×100 grubu — 2 tasarım → -%3
      ...Array.from({ length: 2 }, (_, i) => makeLine(i + 200, 100, 100, 5000)),
      // 25×80 grubu — 1 tasarım → 0
      makeLine(300, 25, 80, 500),
    ];

    const result = computeCart(lines);

    expect(Object.keys(result.groups)).toHaveLength(4);

    // Subtotal: 6×1000 + 3×2000 + 2×5000 + 1×500 = 6000 + 6000 + 10000 + 500 = 22500
    expect(result.subtotal).toBe(22500);

    // İndirim:
    //   50×50: 6×1000×0.08 = 480
    //   70×70: 3×2000×0.05 = 300
    //   100×100: 2×5000×0.03 = 300
    //   25×80: 1×500×0 = 0
    //   Toplam: 1080
    expect(result.groupDiscountTotal).toBe(1080);
    expect(result.total).toBe(21420);

    // Her line'da grup bilgisi doğru atanmış
    for (const item of result.items) {
      const sameGroupCount = result.items.filter(
        (i) => i.width === item.width && i.height === item.height
      ).length;
      expect(item.groupCount).toBe(sameGroupCount);
    }
  });

  test("totalStickers tüm line'ların requestedQty toplamı", () => {
    const lines = [
      makeLine(1, 50, 50, 1000, 100),
      makeLine(2, 70, 70, 2000, 250),
      makeLine(3, 100, 100, 5000, 500),
    ];
    const result = computeCart(lines);

    expect(result.totalStickers).toBe(850);
  });

  test("Aynı boyutta farklı qty olabilir, gruplama boyut bazlı", () => {
    const lines = [
      makeLine(1, 50, 50, 500, 100),
      makeLine(2, 50, 50, 1000, 250),
      makeLine(3, 50, 50, 2000, 500),
    ];
    const result = computeCart(lines);

    // 3 tasarım aynı 50×50 → -%5
    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.groupCount).toBe(3);
      expect(item.groupDiscountPct).toBe(0.05);
    }
  });
});

describe("computeCart — groupKey deterministik", () => {
  test("aynı boyut → aynı key", () => {
    const result = computeCart([
      makeLine(1, 50, 50, 1000),
      makeLine(2, 50, 50, 2000),
    ]);

    expect(result.items[0].groupKey).toBe(result.items[1].groupKey);
  });

  test("farklı boyut → farklı key", () => {
    const result = computeCart([
      makeLine(1, 50, 50, 1000),
      makeLine(2, 50, 51, 1000), // sadece 1mm fark
    ]);

    expect(result.items[0].groupKey).not.toBe(result.items[1].groupKey);
  });
});
