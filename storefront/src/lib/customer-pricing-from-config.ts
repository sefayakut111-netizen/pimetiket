/**
 * Customer-pricing bridge — admin live_config'ten müşteri-shape quote üretir.
 *
 * Sefa 19 May v68 (Faz 2 — admin↔müşteri fiyat sync):
 *   - Admin /admin/fiyatlar'da değişiklik → müşteri /sticker /etiket anında yansır
 *   - Eski hardcoded MATERIAL_MULT / FINISH_MULT bypass edilir
 *   - Geometri (cols, rows, sheetsNeeded) için ESKİ engine kullanılır
 *     (preview rendering değişmesin)
 *   - Fiyat için calculatePrice + admin live_config
 *
 * Müşteri sayfası şu sırayı kullanır:
 *   1. getLivePricingConfig(scope) — DB'den live config çek (5dk cache)
 *   2. quoteStickerFromConfig(config, input) — bridge fiyat üret
 *   3. Output mevcut quoteCustomerSticker shape'ine BIRE BIR uyumlu
 *      (UI değişikliği gerekmesin)
 *
 * Eğer config eksik / hatalıysa null döner → caller eski engine'e fallback yapar.
 */

import { calculatePrice } from "./pricing-calc";
import type { ProfileConfig } from "./pricing-config-types";
import { quoteSticker, quoteEtiket } from "./pricing-engine";
import type {
  CustomerQuoteResult,
  CustomerQuoteInput,
} from "./sticker-customer-pricing";
import type {
  CustomerEtiketQuoteResult,
  CustomerEtiketQuoteInput,
} from "./etiket-customer-pricing";

// ============================================================
// Sticker bridge
// ============================================================

/**
 * Admin config + customer input → CustomerQuoteResult (sticker).
 *
 * Geometri (cols, rows, sheetsNeeded) için eski engine'i çağırır
 * (UI preview değişmesin), fiyat hesabı için calculatePrice +
 * admin live_config kullanır.
 *
 * Return null → admin config eksik / geometriden negatif sonuç.
 * Caller eski quoteCustomerSticker'a fallback yapmalı.
 */
export function quoteStickerFromConfig(
  config: ProfileConfig,
  input: CustomerQuoteInput
): CustomerQuoteResult | null {
  // 1. Geometri için eski engine — sadece preview verisi için
  //    (fason rate burada önemli değil, sadece cols/rows hesabı için)
  const geomResult = quoteSticker({
    width: input.width,
    height: input.height,
    cut: input.cut ?? "diecut",
    qty: input.qty,
    production: { mode: "fason", rate: 100 }, // dummy rate
    operation: { setup: 0, packaging: 0, cargo: 0, feePct: 0 },
    margin: { marginPct: 0, vatPct: 0, minMarkupFraction: 0 },
  });

  if (!geomResult.ok) {
    return {
      ok: false,
      reason: geomResult.reason,
      bigEtiketRedirect: geomResult.bigEtiketRedirect,
    };
  }

  // 2. Fiyat hesabı — admin config + calculatePrice
  const selected_options: Record<string, string | string[]> = {
    finish: input.finish,
  };

  const priceResult = calculatePrice(
    {
      width_mm: input.width,
      height_mm: input.height,
      qty: input.qty,
      material_id: input.material,
      selected_options,
    },
    config
  );

  if (!priceResult.ok) {
    // Material/option ID admin config'inde yok → caller fallback'a düşer
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
    // Surcharge artık admin config'in options.finish.items[].pct_add'inde — UI 1.0
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

// ============================================================
// Etiket bridge
// ============================================================

/**
 * Admin config + customer input → CustomerEtiketQuoteResult.
 *
 * Etiket'te formFactor (rulo / tabaka) önemli:
 *   - rulo → config.pricing_mode = "area"   (m² × cost)
 *   - tabaka → config.pricing_mode = "sheet" (sheet_cost × sheets_needed)
 *
 * Geometri eski engine'den, fiyat calculatePrice'tan.
 */
export function quoteEtiketFromConfig(
  config: ProfileConfig,
  input: CustomerEtiketQuoteInput
): CustomerEtiketQuoteResult | null {
  // 1. Geometri eski engine — preview için
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

  // 2. Fiyat hesabı — admin config
  //    coating tek-seçim, customization çoklu-seçim
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

  // Tabaka modunda sheets_needed gerekli — geometri'den çek
  // (etiket-pricing engine'de rollsNeeded var, tabaka için sheets eşdeğeri)
  const sheets_needed =
    config.pricing_mode === "sheet"
      ? Math.max(1, geomResult.geometry.rollsNeeded)
      : undefined;

  const priceResult = calculatePrice(
    {
      width_mm: input.width,
      height_mm: input.height,
      qty: input.qty,
      material_id: input.material,
      selected_options,
      sheets_needed,
    },
    config
  );

  if (!priceResult.ok) {
    console.warn(
      `[customer-pricing-bridge] etiket calc failed: ${priceResult.reason}`,
      priceResult.hint
    );
    return null;
  }

  const { geometry, effectiveRate, multipliers } = geomResult;

  return {
    ok: true,
    total: priceResult.final,
    unitPrice: priceResult.unit_price,
    rollsNeeded: geometry.rollsNeeded,
    geometry: {
      cols: geometry.cols,
      rowsPerSheet: geometry.rowsPerRoll,
      perSheet: geometry.perRoll,
    },
    effectiveRate, // UI'da gizli ama tip uyumu için tutuluyor
    multipliers,
  };
}
