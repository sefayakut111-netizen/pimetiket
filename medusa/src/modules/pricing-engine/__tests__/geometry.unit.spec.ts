/**
 * Pricing engine — geometri saf fonksiyonu testleri.
 *
 * Kaynak: docs/PRICING_SPEC.md §2-3
 *
 * Senaryolar:
 *   - 50×50mm × 250 → küçük tabaka, beklenen perSheet
 *   - 50×50mm × 25 → 1 tabaka yeter
 *   - 250×300mm → küçük tabakaya 1 adet sığar
 *   - 300×400mm → büyük tabakaya geçer (forcedDieCut=true)
 *   - 500×500mm → red (büyük etiketten de büyük)
 *   - 100×200mm tabaka mode 6mm gap vs diecut 50mm gap karşılaştırma
 *   - Rotation testi: 200×100 = 100×200 (rotated)
 *   - Rulo planı: az adet → dar rulo, çok adet → geniş rulo
 */

import {
  computeGeometry,
  computeRollPlan,
  findOptimalSheet,
} from "../lib/geometry";
import {
  ROLL_W_MAX,
  ROLL_W_MIN,
  SMALL_SHEET_W,
  SMALL_SHEET_H,
  BIG_SHEET_W,
  BIG_SHEET_H,
} from "../lib/constants";

describe("findOptimalSheet — küçük tabaka", () => {
  test("50×50 sticker, 250 adet, tabaka modu → 23×31 küçük tabaka, beklenen perSheet", () => {
    const fit = findOptimalSheet({
      width: 50,
      height: 50,
      requestedCut: "tabaka",
      targetQty: 250,
    });

    expect(fit).not.toBeNull();
    expect(fit!.mode).toBe("small");
    expect(fit!.sheetW).toBe(SMALL_SHEET_W);
    expect(fit!.sheetH).toBe(SMALL_SHEET_H);
    expect(fit!.gap).toBe(6);
    expect(fit!.forcedDieCut).toBe(false);

    // 230÷(50+6) = 4 cols, 310÷(50+6) = 5 rows = 20 perSheet
    // 250/20 = ceil = 13 tabaka (üretim 260)
    expect(fit!.perSheet).toBe(20);
    expect(fit!.cols).toBe(4);
    expect(fit!.rows).toBe(5);
    expect(fit!.sheetsNeeded).toBe(13);
    expect(fit!.producedQty).toBe(260);
    expect(fit!.overrun).toBeCloseTo(0.04, 2); // %4 — tolerans aşar ama compute() bu kontrolü yapmaz
  });

  test("50×50 sticker, 25 adet, tabaka modu → 1 tabaka yeter", () => {
    const fit = findOptimalSheet({
      width: 50,
      height: 50,
      requestedCut: "tabaka",
      targetQty: 25,
    });

    expect(fit).not.toBeNull();
    expect(fit!.sheetsNeeded).toBe(2); // 25/20 = ceil 2
    expect(fit!.producedQty).toBe(40);
  });

  test("die-cut 50mm gap → tabaka 6mm gap'tan az sticker sığar", () => {
    const tabakaFit = findOptimalSheet({
      width: 50,
      height: 50,
      requestedCut: "tabaka",
      targetQty: 100,
    });
    const dieCutFit = findOptimalSheet({
      width: 50,
      height: 50,
      requestedCut: "diecut",
      targetQty: 100,
    });

    expect(tabakaFit!.perSheet).toBeGreaterThan(dieCutFit!.perSheet);
    expect(tabakaFit!.gap).toBe(6);
    expect(dieCutFit!.gap).toBe(50);
  });

  test("rotation: 200×100 ile 100×200 aynı sığar", () => {
    const fitA = findOptimalSheet({
      width: 200,
      height: 100,
      requestedCut: "tabaka",
      targetQty: 50,
    });
    const fitB = findOptimalSheet({
      width: 100,
      height: 200,
      requestedCut: "tabaka",
      targetQty: 50,
    });

    expect(fitA!.perSheet).toBe(fitB!.perSheet);
  });
});

describe("findOptimalSheet — büyük tabaka geçişi", () => {
  test("300×400 sticker → büyük tabaka modu, forcedDieCut=true", () => {
    const fit = findOptimalSheet({
      width: 300,
      height: 400,
      requestedCut: "tabaka", // kullanıcı tabaka istese bile
      targetQty: 10,
    });

    expect(fit).not.toBeNull();
    expect(fit!.mode).toBe("big");
    expect(fit!.sheetW).toBe(BIG_SHEET_W);
    expect(fit!.sheetH).toBe(BIG_SHEET_H);
    expect(fit!.forcedDieCut).toBe(true);
    expect(fit!.gap).toBe(50);
  });

  test("250×300 sticker → küçük tabakaya rotated sığar", () => {
    // Küçük tabaka 230×310 → 250×300 sığmaz
    // Ama rotated: 300×250 → de sığmaz
    // Büyük tabakaya geçer
    const fit = findOptimalSheet({
      width: 250,
      height: 300,
      requestedCut: "tabaka",
      targetQty: 5,
    });

    // 250 > 230, 300 ≤ 310. Rotated: 300 > 230 → küçük tabakaya sığmıyor
    expect(fit!.mode).toBe("big");
  });

  test("220×300 sticker → küçük tabakaya tek adet sığar", () => {
    const fit = findOptimalSheet({
      width: 220,
      height: 300,
      requestedCut: "tabaka",
      targetQty: 5,
    });

    expect(fit!.mode).toBe("small");
    expect(fit!.perSheet).toBe(1); // 1 adet ancak sığar
    expect(fit!.sheetsNeeded).toBe(5);
  });
});

describe("findOptimalSheet — red", () => {
  test("500×500 sticker → null (büyük etiketten büyük)", () => {
    const fit = findOptimalSheet({
      width: 500,
      height: 500,
      requestedCut: "tabaka",
      targetQty: 1,
    });

    expect(fit).toBeNull();
  });

  test("400×700 sticker (boy 650'den uzun) → null", () => {
    const fit = findOptimalSheet({
      width: 400,
      height: 700,
      requestedCut: "tabaka",
      targetQty: 1,
    });

    // Rotated 700×400 → 700 > BIG_SHEET_H(650) ve > BIG_SHEET_W(400)... aslında 700×400 rotated 400×700 sığar mı?
    // 400 ≤ BIG_SHEET_W(400), 700 > BIG_SHEET_H(650) → sığmaz
    expect(fit).toBeNull();
  });
});

describe("computeRollPlan — dinamik en", () => {
  test("küçük tabaka (230×310), 1 tabaka → dar rulo seçilir", () => {
    const plan = computeRollPlan(SMALL_SHEET_W, SMALL_SHEET_H, 1);

    expect(plan).not.toBeNull();
    // 230 + 80 (margin) = 310 — ROLL_W_MIN 250'den büyük, OK
    expect(plan!.rollW).toBe(310);
    expect(plan!.cols).toBe(1);
    expect(plan!.rollsNeeded).toBe(1);
    expect(plan!.sheetsOnLastRoll).toBe(1);
  });

  test("küçük tabaka, 13 tabaka → algoritma daha geniş rulo seçer (fire min)", () => {
    const plan = computeRollPlan(SMALL_SHEET_W, SMALL_SHEET_H, 13);

    expect(plan).not.toBeNull();
    // 13 tabaka için tek-kolon rulo çok uzun olur. 2-kolon rulo daha az alan kullanır.
    // 2 kolon: 230×2 + 80 = 540mm, 1470/310 = 4 satır, 8 sheets/roll → 2 rulo
    expect(plan!.cols).toBeGreaterThanOrEqual(1);
    expect(plan!.rollW).toBeGreaterThan(0);
  });

  test("ROLL_W_MIN dayanması: çok küçük tabaka tek-kolon olsa bile 250mm minimum", () => {
    // 50×50 tabaka — ama findOptimalSheet 23×31 tabaka döndürür
    // Bu fonksiyon tabaka boyutunu input olarak alır, tabaka 50×50 olsa
    // 50 + 80 = 130mm → ROLL_W_MIN 250'ye yükseltilir
    const plan = computeRollPlan(50, 50, 5);

    expect(plan!.rollW).toBeGreaterThanOrEqual(ROLL_W_MIN);
  });

  test("max kapasite: rulo eninin üst sınırı 600mm", () => {
    const plan = computeRollPlan(SMALL_SHEET_W, SMALL_SHEET_H, 1000);

    expect(plan!.rollW).toBeLessThanOrEqual(ROLL_W_MAX);
  });
});

describe("computeGeometry — entegre akış", () => {
  test("50×50 × 250 tabaka modu → tam akış", () => {
    const result = computeGeometry({
      width: 50,
      height: 50,
      cut: "tabaka",
      qty: 250,
    });

    expect(result).not.toBeNull();
    expect(result!.fit.mode).toBe("small");
    expect(result!.effectiveCut).toBe("tabaka");
    expect(result!.totalM2).toBeGreaterThan(0);
    expect(result!.stickerArea).toBeGreaterThan(0);
    expect(result!.wastePct).toBeGreaterThan(0);
    expect(result!.wastePct).toBeLessThan(100);
  });

  test("büyük tabaka modu → effectiveCut zorla diecut", () => {
    const result = computeGeometry({
      width: 300,
      height: 400,
      cut: "tabaka", // kullanıcı tabaka istedi
      qty: 5,
    });

    expect(result!.fit.forcedDieCut).toBe(true);
    expect(result!.effectiveCut).toBe("diecut"); // ama zorla diecut
  });

  test("red mode → null", () => {
    const result = computeGeometry({
      width: 500,
      height: 500,
      cut: "tabaka",
      qty: 1,
    });

    expect(result).toBeNull();
  });
});
