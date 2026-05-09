/**
 * Pricing engine — sepet grup indirimi testleri.
 *
 * Kaynak: docs/PRICING_SPEC.md §6
 *
 * v0.4: API değişti — preGroupTotal (KDV dahil) → preGroupSubtotal (KDV hariç)
 * Bkz: PRICING_FINANCE_REVIEW.md §1 — KDV mevzuatı m.25/a uyumu
 *
 * Senaryolar v0.4'e göre güncellendi.
 */

import { computeCart, getGroupDiscount } from "../lib/cart-discount";
import type { CartLineInput } from "../lib/cart-discount";

const lineId = (n: number) => `line-${n}`;

function makeLine(
  n: number,
  width: number,
  height: number,
  preGroupSubtotal: number,
  qty = 250,
  vatPct = 20
): CartLineInput {
  return {
    id: lineId(n),
    width,
    height,
    requestedQty: qty,
    preGroupSubtotal,
    vatPct,
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

  // v0.4: preGroupSubtotal=1000 (matrah), VAT 20% → preGroupTotal=1200
  test("1 tasarım → indirim 0, finalSubtotal = preGroupSubtotal", () => {
    const result = computeCart([makeLine(1, 50, 50, 1000)]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].groupDiscountPct).toBe(0);
    expect(result.items[0].finalSubtotal).toBe(1000);
    expect(result.items[0].finalVat).toBe(200); // 1000 × 20%
    expect(result.items[0].finalTotal).toBe(1200);
    expect(result.total).toBe(1200);
  });
});

describe("computeCart — aynı boyut grubu indirimi (v0.4: KDV ÖNCESİ)", () => {
  // v0.4: indirim matraha (1000) uygulanır, VAT discounted matrah üzerinden
  test("2 aynı boyut (50×50, 1000 TL matrah) → -%3 matrahta", () => {
    const lines = [makeLine(1, 50, 50, 1000), makeLine(2, 50, 50, 1000)];
    const result = computeCart(lines);

    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.03);
      expect(item.groupDiscountAmount).toBe(30); // matrah × 3%
      expect(item.finalSubtotal).toBe(970);
      expect(item.finalVat).toBe(194); // 970 × 20%
      expect(item.finalTotal).toBe(1164); // 970 + 194
    }
    // Aggregate
    expect(result.subtotalBeforeDiscount).toBe(2000);
    expect(result.groupDiscountTotal).toBe(60);
    expect(result.subtotalAfterDiscount).toBe(1940);
    expect(result.vatTotal).toBe(388); // 1940 × 20%
    expect(result.total).toBe(2328); // 1940 + 388
  });

  test("6 aynı boyut → her birine -%8 matrahta", () => {
    const lines = Array.from({ length: 6 }, (_, i) =>
      makeLine(i, 50, 50, 1000)
    );
    const result = computeCart(lines);

    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.08);
      expect(item.finalSubtotal).toBe(920);
      expect(item.finalTotal).toBe(1104); // 920 × 1.20
    }
    expect(result.total).toBe(6624); // 6 × 1104
  });

  test("10 aynı boyut → -%10", () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      makeLine(i, 50, 50, 1000)
    );
    const result = computeCart(lines);

    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.1);
      expect(item.finalSubtotal).toBe(900);
      expect(item.finalTotal).toBe(1080);
    }
    expect(result.total).toBe(10800); // 10 × 1080
  });

  test("15 aynı boyut → -%10 cap", () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      makeLine(i, 50, 50, 1000)
    );
    const result = computeCart(lines);

    for (const item of result.items) {
      expect(item.groupDiscountPct).toBe(0.1);
    }
    expect(result.total).toBe(16200); // 15 × 1080
  });
});

describe("computeCart — karışık gruplar (v0.4)", () => {
  test("4 farklı boyut grubu, KDV öncesi indirim", () => {
    const lines = [
      ...Array.from({ length: 6 }, (_, i) => makeLine(i, 50, 50, 1000)),
      ...Array.from({ length: 3 }, (_, i) => makeLine(i + 100, 70, 70, 2000)),
      ...Array.from({ length: 2 }, (_, i) => makeLine(i + 200, 100, 100, 5000)),
      makeLine(300, 25, 80, 500),
    ];

    const result = computeCart(lines);

    expect(Object.keys(result.groups)).toHaveLength(4);
    expect(result.subtotalBeforeDiscount).toBe(22500); // 6000+6000+10000+500
    // İndirim matraha:
    //   50×50: 6×1000×0.08 = 480
    //   70×70: 3×2000×0.05 = 300
    //   100×100: 2×5000×0.03 = 300
    //   25×80: 0
    //   Total: 1080
    expect(result.groupDiscountTotal).toBe(1080);
    expect(result.subtotalAfterDiscount).toBe(21420);
    expect(result.vatTotal).toBe(4284); // 21420 × 20%
    expect(result.total).toBe(25704); // 21420 × 1.20

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
