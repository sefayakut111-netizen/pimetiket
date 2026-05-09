/**
 * Pricing engine — maliyet+fiyat saf fonksiyonu testleri.
 *
 * Kaynak: docs/PRICING_SPEC.md §4-5
 *
 * Senaryolar:
 *   - Fason mod: tek kalem cost
 *   - Üretim mod: 6 kalem cost
 *   - Tier 250 referans (×1.00) — ayar yok
 *   - Tier 25 (+%30 zam) — preTierSubtotal'a uygulanır
 *   - Tier 1000 (−%20 indirim) — negatif tierAdjustment
 *   - KDV %20 — subtotal × 0.20
 *   - Big mode → paketleme × 2
 *   - findTier — exact match ve closest match
 */

import { computeGeometry } from "../lib/geometry";
import { computeCost, findTier } from "../lib/cost";
import { STICKER_TIERS } from "../lib/constants";
import type { ProductionRates, OperationRates, MarginConfig } from "../lib/cost";

const DEFAULT_FASON: ProductionRates = { mode: "fason", rate: 120 };
const DEFAULT_URETIM: ProductionRates = {
  mode: "uretim",
  paper: 45,
  ink: 25,
  coating: 15,
  labor: 35,
  overhead: 15,
  depreciation: 10,
};
const DEFAULT_OPERATION: OperationRates = {
  setup: 50,
  packaging: 15,
  cargo: 80,
  feePct: 2.5,
};
const DEFAULT_MARGIN: MarginConfig = { marginPct: 75, vatPct: 20 };

const REFERENCE_TIER = STICKER_TIERS.find((t) => t.qty === 250)!;
const TIER_25 = STICKER_TIERS.find((t) => t.qty === 25)!;
const TIER_1000 = STICKER_TIERS.find((t) => t.qty === 1000)!;

function geom(width: number, height: number, qty: number) {
  const g = computeGeometry({ width, height, cut: "tabaka", qty });
  if (!g) throw new Error("geometry returned null in test setup");
  return g;
}

describe("computeCost — fason mod", () => {
  test("250 adet 50×50 referans tier → tek kalem productionItem", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    expect(result.productionItems).toHaveLength(1);
    expect(result.productionItems[0].name).toBe("Fason Üretim");
    expect(result.productionCost).toBeCloseTo(g.totalM2 * 120, 2);
  });

  test("operasyon 3 kalem (hazırlık + paketleme + kargo)", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    expect(result.operationItems).toHaveLength(3);
    expect(result.operationItems[0].name).toBe("Hazırlık");
    expect(result.operationItems[0].amount).toBe(50);
  });
});

describe("computeCost — üretim mod 6 kalem", () => {
  test("üretim mod → 6 ayrı productionItem", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_URETIM,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    expect(result.productionItems).toHaveLength(6);
    const names = result.productionItems.map((i) => i.name);
    expect(names).toEqual([
      "Kağıt / Folio",
      "Mürekkep",
      "Kaplama",
      "İşçilik",
      "Genel Gider",
      "Amortisman",
    ]);

    // Toplam 145 TL/m² (45+25+15+35+15+10)
    const expectedTotal = g.totalM2 * 145;
    expect(result.productionCost).toBeCloseTo(expectedTotal, 2);
  });
});

describe("computeCost — tier davranışı", () => {
  test("250 referans tier → tierAdjustment ≈ 0", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    expect(result.tierMultiplier).toBe(1.0);
    expect(result.tierAdjustment).toBeCloseTo(0, 5);
    expect(result.subtotal).toBeCloseTo(result.preTierSubtotal, 5);
  });

  test("25 adet tier (+%30 zam) → tierAdjustment pozitif", () => {
    const g = geom(50, 50, 25);
    const result = computeCost({
      geometry: g,
      requestedQty: 25,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: TIER_25,
    });

    expect(result.tierMultiplier).toBe(1.3);
    expect(result.tierAdjustment).toBeGreaterThan(0);
    expect(result.subtotal).toBeCloseTo(result.preTierSubtotal * 1.3, 2);
  });

  test("1000 adet tier (−%20 indirim) → tierAdjustment negatif", () => {
    const g = geom(50, 50, 1000);
    const result = computeCost({
      geometry: g,
      requestedQty: 1000,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: TIER_1000,
    });

    expect(result.tierMultiplier).toBe(0.8);
    expect(result.tierAdjustment).toBeLessThan(0);
    expect(result.subtotal).toBeCloseTo(result.preTierSubtotal * 0.8, 2);
  });
});

describe("computeCost — KDV", () => {
  test("KDV %20 → vatAmount = subtotal × 0.20, total = subtotal + vatAmount", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    expect(result.vatAmount).toBeCloseTo(result.subtotal * 0.2, 2);
    expect(result.total).toBeCloseTo(result.subtotal * 1.2, 2);
  });

  test("KDV %0 → vatAmount sıfır, total = subtotal", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: { marginPct: 75, vatPct: 0 },
      tier: REFERENCE_TIER,
    });

    expect(result.vatAmount).toBe(0);
    expect(result.total).toBeCloseTo(result.subtotal, 2);
  });
});

describe("computeCost — büyük tabaka paketleme × 2", () => {
  test("big mode → paketleme TL/koli 2× artar, label 'koli'", () => {
    const g = geom(300, 400, 5); // big mode
    expect(g.fit.mode).toBe("big");

    const result = computeCost({
      geometry: g,
      requestedQty: 5,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    const packagingItem = result.operationItems.find((i) =>
      i.name.includes("Paketleme")
    );
    expect(packagingItem).toBeDefined();
    expect(packagingItem!.name).toBe("Paketleme (büyük koli)");
    expect(packagingItem!.formula).toContain("koli");
    // Büyük tabakada packaging × 2 (15 → 30)
    expect(packagingItem!.formula).toContain("30 TL");
  });
});

describe("computeCost — birim fiyat", () => {
  test("unitPrice = total / requestedQty", () => {
    const g = geom(50, 50, 250);
    const result = computeCost({
      geometry: g,
      requestedQty: 250,
      production: DEFAULT_FASON,
      operation: DEFAULT_OPERATION,
      margin: DEFAULT_MARGIN,
      tier: REFERENCE_TIER,
    });

    expect(result.unitPrice).toBeCloseTo(result.total / 250, 4);
  });
});

describe("findTier — adet eşleştirme", () => {
  test("exact match: 250 → REFERENCE_TIER", () => {
    expect(findTier(250)).toBe(REFERENCE_TIER);
  });

  test("exact match: 1000 → TIER_1000", () => {
    expect(findTier(1000)).toBe(TIER_1000);
  });

  test("closest match: 200 → 250 (en yakın)", () => {
    expect(findTier(200).qty).toBe(250);
  });

  test("closest match: 75 → 50 veya 100, hangi yakınsa", () => {
    // 75'e 50 ve 100 eşit uzak (her ikisi 25). Implementation ilk match'e gider → 50
    const tier = findTier(75);
    expect([50, 100]).toContain(tier.qty);
  });
});
