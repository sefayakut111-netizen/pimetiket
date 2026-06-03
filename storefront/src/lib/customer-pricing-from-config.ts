/**
 * Customer-pricing bridge — admin live_config + price book.
 */

import { calculatePrice } from "./pricing-calc";
import type { ProfileConfig } from "./pricing-config-types";
import { calcTabakaSheets, calculateTabakaSheetGeometry } from "./pricing-tabaka-geo";
import {
  FALLBACK_PRICEBOOK_SNAPSHOT,
  isPricebookMode,
  quoteRuloFromPricebook,
  type PricebookSnapshot,
} from "./pricing-pricebook";
import { quoteSticker, computeRollPlan, quoteEtiket } from "./pricing-engine";
import type {
  CustomerQuoteResult,
  CustomerQuoteInput,
} from "./sticker-customer-pricing";
import {
  resolveStickerGeomCut,
  resolveStickerQuoteDimensions,
} from "./sticker-customer-pricing";
import type {
  CustomerEtiketQuoteResult,
  CustomerEtiketQuoteInput,
} from "./etiket-customer-pricing";

export function quoteStickerFromConfig(
  config: ProfileConfig,
  input: CustomerQuoteInput
): CustomerQuoteResult | null {
  const { geomWidth, geomHeight, pricingWidthMm, pricingHeightMm } =
    resolveStickerQuoteDimensions(input);

  if (input.pageMode) {
    const rollPlan = computeRollPlan(geomWidth, geomHeight, input.qty);
    if (!rollPlan) {
      return {
        ok: false,
        reason: "Sayfa boyutu plotter rulosuna sığmıyor.",
      };
    }
    const billable_m2 = rollPlan.totalArea / 1_000_000;
    const priceResult = calculatePrice(
      {
        width_mm: pricingWidthMm,
        height_mm: pricingHeightMm,
        qty: input.qty,
        material_id: input.material,
        selected_options: { finish: input.finish },
        billable_m2,
        cut_type: "tabaka",
      },
      config,
      "sticker"
    );
    if (!priceResult.ok) {
      console.warn(
        `[customer-pricing-bridge] sticker pageMode calc failed: ${priceResult.reason}`,
        priceResult.hint
      );
      return null;
    }
    return {
      ok: true,
      total: priceResult.final,
      unitPrice: priceResult.unit_price,
      overrunCount: 0,
      tierMultiplier: priceResult.tier.multiplier,
      surchargeMultiplier: 1,
      geometry: {
        cols: rollPlan.cols,
        rows: rollPlan.rows,
        perSheet: 1,
        sheetsNeeded: input.qty,
        sheetW: geomWidth,
        sheetH: geomHeight,
      },
    };
  }

  const geomCut = resolveStickerGeomCut(input.cut);
  const geomResult = quoteSticker({
    width: geomWidth,
    height: geomHeight,
    cut: geomCut,
    qty: input.qty,
    production: { mode: "fason", rate: 100 },
    operation: { setup: 0, packaging: 0, feePct: 0 },
  });

  if (!geomResult.ok) {
    return {
      ok: false,
      reason: geomResult.reason,
      bigEtiketRedirect: geomResult.bigEtiketRedirect,
    };
  }

  const selected_options: Record<string, string | string[]> = {
    finish: input.finish,
  };

  const priceResult = calculatePrice(
    {
      width_mm: pricingWidthMm,
      height_mm: pricingHeightMm,
      qty: input.qty,
      material_id: input.material,
      selected_options,
      billable_m2: geomResult.geometry.totalM2,
      cut_type: input.cut ?? "diecut",
    },
    config,
    "sticker"
  );

  if (!priceResult.ok) {
    console.warn(
      `[customer-pricing-bridge] sticker calc failed: ${priceResult.reason}`,
      priceResult.hint
    );
    return null;
  }

  const { geometry } = geomResult;
  const overrunCount = Math.max(geometry.fit.producedQty - input.qty, 0);

  return {
    ok: true,
    total: priceResult.final,
    unitPrice: priceResult.unit_price,
    overrunCount,
    tierMultiplier: priceResult.tier.multiplier,
    surchargeMultiplier: 1,
    geometry: {
      cols: geometry.fit.cols,
      rows: geometry.fit.rows,
      perSheet: geometry.fit.perSheet,
      sheetsNeeded: geometry.fit.sheetsNeeded,
      sheetW: geometry.fit.sheetW,
      sheetH: geometry.fit.sheetH,
    },
  };
}

export interface EtiketBridgeOptions {
  /** Rulo vs tabaka — pricebook yalnızca rulo için */
  formFactor?: "rulo" | "tabaka";
  pricebookSnapshot?: PricebookSnapshot;
}

export function quoteEtiketFromConfig(
  config: ProfileConfig,
  input: CustomerEtiketQuoteInput,
  options?: EtiketBridgeOptions
): CustomerEtiketQuoteResult | null {
  const geomResult = quoteEtiket({
    width: input.width,
    height: input.height,
    qty: input.qty,
    materialId: input.material,
    coatingId: input.coating,
    customizationId: input.customization,
    customizationIds: input.customizations,
    production: { mode: "fason", rate: 100 },
    operation: { setup: 0, packaging: 0, cargo: 0, feePct: 0 },
    margin: { marginPct: 0, vatPct: 0, minMarkupFraction: 0 },
  });

  if (!geomResult.ok) {
    return { ok: false, reason: geomResult.reason };
  }

  const customsArr =
    input.customizations && input.customizations.length > 0
      ? input.customizations
      : input.customization
        ? [input.customization]
        : [];

  const selected_options: Record<string, string | string[]> = {
    coating: input.coating,
    customization: customsArr,
  };

  const { geometry, effectiveRate, multipliers } = geomResult;
  const formFactor = options?.formFactor ?? "rulo";

  // Rulo — partner price book (tabaka modunda kullanılmaz)
  if (formFactor === "rulo" && isPricebookMode(config)) {
    const snapshot =
      options?.pricebookSnapshot ?? FALLBACK_PRICEBOOK_SNAPSHOT;
    const pb = quoteRuloFromPricebook(snapshot, config, {
      width_mm: input.width,
      height_mm: input.height,
      qty: input.qty,
      material_key: input.material,
      selected_options,
    });

    if (!pb.ok) {
      return { ok: false, reason: pb.hint ?? pb.reason };
    }

    return {
      ok: true,
      total: pb.total,
      unitPrice: pb.unitPrice,
      rollsNeeded: geometry.rollsNeeded,
      geometry: {
        cols: geometry.cols,
        rowsPerSheet: geometry.rowsPerRoll,
        perSheet: geometry.perRoll,
      },
      effectiveRate,
      multipliers,
    };
  }

  // Tabaka — sheet modu
  const tabakaGeom =
    formFactor === "tabaka" || config.pricing_mode === "sheet"
      ? calculateTabakaSheetGeometry(input.width, input.height, input.qty)
      : null;

  if (tabakaGeom && tabakaGeom.per_sheet === 0) {
    return {
      ok: false,
      reason: "Bu boyut tabakaya sığmıyor — daha küçük ölçü seçin.",
    };
  }

  const sheets_needed =
    tabakaGeom != null
      ? tabakaGeom.sheets_needed
      : config.pricing_mode === "sheet"
        ? calcTabakaSheets(input.width, input.height, input.qty)
        : undefined;

  const billable_m2 =
    config.pricing_mode === "sheet"
      ? undefined
      : geomResult.geometry.totalM2;

  const priceResult = calculatePrice(
    {
      width_mm: input.width,
      height_mm: input.height,
      qty: input.qty,
      material_id: input.material,
      selected_options,
      sheets_needed,
      billable_m2,
    },
    config,
    formFactor === "tabaka" || config.pricing_mode === "sheet"
      ? "etiket_tabaka"
      : undefined
  );

  if (!priceResult.ok) {
    console.warn(
      `[customer-pricing-bridge] etiket calc failed: ${priceResult.reason}`,
      priceResult.hint
    );
    return null;
  }

  return {
    ok: true,
    total: priceResult.final,
    unitPrice: priceResult.unit_price,
    rollsNeeded: geometry.rollsNeeded,
    geometry: tabakaGeom
      ? {
          cols: tabakaGeom.cols,
          rowsPerSheet: tabakaGeom.rows,
          perSheet: tabakaGeom.per_sheet,
        }
      : {
          cols: geometry.cols,
          rowsPerSheet: geometry.rowsPerRoll,
          perSheet: geometry.perRoll,
        },
    effectiveRate,
    multipliers,
  };
}
