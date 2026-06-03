/**
 * Checkout recalc regresyon — Kartlı sticker client/sunucu fiyat hizası.
 * PayTR veya canlı DB gerektirmez; FALLBACK_STICKER_CONFIG kullanır.
 */
import { quoteStickerFromConfig } from "../src/lib/customer-pricing-from-config";
import { FALLBACK_STICKER_CONFIG } from "../src/lib/pricing-config-types";
import { expectedCartLineFromPerDesignQuote } from "../src/lib/design-count-pricing";
import { computeGeometry, computeRollPlan } from "../src/lib/pricing-engine/geometry";
import { OVERAGE_TARGET_MAX } from "../src/lib/pricing-engine/constants";
import type { StickerCutType } from "../src/lib/sticker-customer-pricing";
import {
  resolveStickerGeomCut,
  resolveStickerQuoteDimensions,
} from "../src/lib/sticker-customer-pricing";

const RECALC_TOLERANCE_PCT = 0.02;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertRecalcPasses(args: {
  cut: StickerCutType;
  width: number;
  height: number;
  qty: number;
}) {
  const input = {
    width: args.width,
    height: args.height,
    qty: args.qty,
    material: "vinil" as const,
    finish: "parlak" as const,
    cut: args.cut,
  };

  const fromConfig = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, input);
  assert(fromConfig?.ok === true, `${args.cut}: config quote failed`);

  if (!fromConfig || !fromConfig.ok) return;

  const cartLine = expectedCartLineFromPerDesignQuote(
    fromConfig.unitPrice,
    args.qty,
    1
  );
  const totalTol = Math.max(0.5, cartLine.total * RECALC_TOLERANCE_PCT);
  assert(
    Math.abs(cartLine.total - fromConfig.total) <= totalTol,
    `${args.cut}: cart line ${cartLine.total} vs quote ${fromConfig.total}`
  );
}

function assertGeometryScenario(args: {
  label: string;
  cut: StickerCutType;
  width: number;
  height: number;
  qty: number;
}) {
  const { geomWidth, geomHeight } = resolveStickerQuoteDimensions({
    width: args.width,
    height: args.height,
    cut: args.cut,
  });
  const engineCut = resolveStickerGeomCut(args.cut);

  const geometry = computeGeometry({
    width: geomWidth,
    height: geomHeight,
    cut: engineCut,
    qty: args.qty,
  });

  assert(geometry != null, `${args.label}: geometry null`);
  if (!geometry) return;

  const { fit, totalM2, roll } = geometry;

  assert(Number.isFinite(totalM2) && totalM2 > 0, `${args.label}: totalM2 invalid`);
  assert(
    fit.overrun <= OVERAGE_TARGET_MAX + 0.001,
    `${args.label}: overage ${(fit.overrun * 100).toFixed(1)}% > ${OVERAGE_TARGET_MAX * 100}%`
  );
  assert(fit.perSheet >= 1, `${args.label}: perSheet < 1`);
  assert(fit.sheetsNeeded >= 1, `${args.label}: sheetsNeeded < 1`);
  assert(roll.rollsNeeded >= 1, `${args.label}: rollsNeeded < 1`);

  if (engineCut === "tabaka") {
    assert(fit.mode === "tabaka", `${args.label}: expected tabaka mode`);
    assert(
      fit.sheetW <= 230 + 1e-9 && fit.sheetH <= 310 + 1e-9,
      `${args.label}: outer tabaka exceeds 230×310`
    );
    assert(
      geometry.sheetAreaM2 > 0,
      `${args.label}: sheetAreaM2 should be > 0 for tabaka`
    );
  } else {
    assert(fit.mode === "diecut", `${args.label}: expected diecut mode`);
    assert(
      geometry.sheetAreaM2 > 0,
      `${args.label}: sheetAreaM2 should be > 0 for diecut (sticker area)`
    );
    assert(
      Math.abs(geometry.sheetAreaM2 - geometry.stickerArea) < 1e-9,
      `${args.label}: diecut sheetAreaM2 should equal stickerArea`
    );
  }
}

function assertPageModeCase(args: {
  label: string;
  width: number;
  height: number;
  qty: number;
  expectedBillableM2: number;
  expectedTotal: number;
}) {
  const rollPlan = computeRollPlan(args.width, args.height, args.qty);
  assert(rollPlan != null, `${args.label}: computeRollPlan null`);
  if (!rollPlan) return;

  const billableM2 = rollPlan.totalArea / 1_000_000;
  assert(
    Math.abs(billableM2 - args.expectedBillableM2) <= 0.002,
    `${args.label}: billable expected ~${args.expectedBillableM2}, got ${billableM2.toFixed(3)}`
  );

  const quote = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
    width: args.width,
    height: args.height,
    qty: args.qty,
    material: "vinil",
    finish: "yok",
    cut: "tabaka",
    pageMode: true,
  });
  assert(quote?.ok === true, `${args.label}: pageMode quote failed`);
  if (!quote?.ok) return;

  assert(
    Math.abs(quote.total - args.expectedTotal) <= 0.5,
    `${args.label}: total expected ${args.expectedTotal}, got ${quote.total.toFixed(2)}`
  );
  assert(quote.overrunCount === 0, `${args.label}: overrunCount should be 0`);
  assert(
    quote.geometry.sheetsNeeded === args.qty,
    `${args.label}: sheetsNeeded should equal qty (sayfa adedi)`
  );
}

/** Faz 3: sepet meta.pageMode → computeStickerQuote ile aynı quote yolu */
function assertPageModeMetaRecalcParity() {
  const itemQty = 25;
  const pageMode = true; // item.meta?.["pageMode"] === true
  const result = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
    width: 210,
    height: 297,
    qty: itemQty,
    material: "vinil",
    finish: "yok",
    cut: "tabaka",
    pageMode,
  });
  assert(result?.ok === true, "pageMode meta recalc: quote failed");
  if (!result?.ok) return;

  const serverLine = expectedCartLineFromPerDesignQuote(
    result.unitPrice,
    itemQty,
    1
  );
  assert(
    Math.abs(serverLine.total - 2436.66) <= 0.5,
    `pageMode meta recalc: expected ~2436.66, got ${serverLine.total.toFixed(2)}`
  );
}

export function runRegressionTests() {
  assertRecalcPasses({
    cut: "kartli",
    width: 75,
    height: 75,
    qty: 25,
  });
  assertRecalcPasses({
    cut: "diecut",
    width: 75,
    height: 75,
    qty: 25,
  });
  assertRecalcPasses({
    cut: "kisscut",
    width: 60,
    height: 60,
    qty: 50,
  });
  assertRecalcPasses({
    cut: "tabaka",
    width: 50,
    height: 50,
    qty: 100,
  });

  assertGeometryScenario({
    label: "tabaka 50×50×100",
    cut: "tabaka",
    width: 50,
    height: 50,
    qty: 100,
  });
  assertGeometryScenario({
    label: "diecut 75×75×25",
    cut: "diecut",
    width: 75,
    height: 75,
    qty: 25,
  });
  assertGeometryScenario({
    label: "diecut kartli 75×75×25",
    cut: "kartli",
    width: 75,
    height: 75,
    qty: 25,
  });
  assertGeometryScenario({
    label: "tabaka 100×150×250",
    cut: "tabaka",
    width: 100,
    height: 150,
    qty: 250,
  });

  const kartli = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
    width: 75,
    height: 75,
    qty: 25,
    material: "vinil",
    finish: "parlak",
    cut: "kartli",
  });
  assert(kartli?.ok === true, "kartli quote must succeed");

  // kartli 75×75×25 baseline: 524.57 → 556.85 (diecut EN1500 rewrite, 2 Haz)
  const KARTLI_BASELINE_TOTAL = 556.85;
  if (kartli?.ok) {
    assert(
      Math.abs(kartli.total - KARTLI_BASELINE_TOTAL) <= 0.5,
      `kartli baseline expected ${KARTLI_BASELINE_TOTAL}, got ${kartli.total.toFixed(2)}`
    );
  }

  // Sticker Sayfası (pageMode) — Faz 1 motor; billable = computeRollPlan m², cut nötr
  assertPageModeCase({
    label: "sayfa A4 210×297×25",
    width: 210,
    height: 297,
    qty: 25,
    expectedBillableM2: 1.979,
    expectedTotal: 2436.66,
  });
  assertPageModeCase({
    label: "sayfa A5 148×210×25",
    width: 148,
    height: 210,
    qty: 25,
    expectedBillableM2: 1.055,
    expectedTotal: 1328.37,
  });
  assertPageModeMetaRecalcParity();

  console.log("[payment-validation-kartli-regression] OK");
  if (kartli?.ok) {
    console.log(`  kartli 75×75 config total: ${kartli.total.toFixed(2)} ₺`);
  }
}

runRegressionTests();
