/**
 * Payment validation — server-side cart item fiyat doğrulaması.
 *
 * Sefa 23 May v68 (Güvenlik analizi P0.1):
 *   Eski payment/init sadece subtotal == Σitem.total kontrol ediyordu.
 *   Saldırgan client'tan düşük unit/total gönderip PayTR'ye düşük tutarla
 *   ödeme başlatabilirdi. Bu helper iki katmanlı koruma sağlar:
 *
 *     1) BRIDGE RECALC — quoteStickerFromConfig / quoteEtiketFromConfig
 *        ile admin live_config kullanarak gerçek fiyat hesaplanır.
 *        Tolerans %2 (kur farkı, opsiyonel rounding ufak sapması için).
 *
 *     2) RECALC ZORUNLU (PARA-FIX M1) — recalc başarısızsa checkout RED;
 *        sanity floor bypass kapatıldı.
 */

import {
  quoteStickerFromConfig,
  quoteEtiketFromConfig,
} from "./customer-pricing-from-config";
import {
  getLivePricingConfig,
  PricingConfigUnavailableError,
} from "./pricing-config";
import type { ProfileConfig } from "./pricing-config-types";
import { fetchPricebookSnapshot } from "./pricing-pricebook-db";
import type { EtiketCustomId } from "./etiket-customer-pricing";
import { isPricebookMode } from "./pricing-pricebook";
import { PRICEBOOK_MAX_QTY } from "./pricing-pricebook-types";
import {
  expectedCartLineFromPerDesignQuote,
  perDesignQty,
  resolveDesignCount,
} from "./design-count-pricing";
import * as Sentry from "@sentry/nextjs";

// ============================================================
// Types
// ============================================================

export interface CartItemForValidation {
  id: string;
  product: "sticker" | "etiket";
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  meta?: Record<string, unknown> | null;
  shape?: string | null;
  cut?: string | null;
  material?: string | null;
  finish?: string | null;
  coatingId?: string | null;
  customizationId?: string | null;
  materialId?: string | null;
  designCount?: number | null;
}

export interface ValidationFailDetail {
  itemId: string;
  reason:
    | "recalc_total_mismatch"
    | "recalc_unit_mismatch"
    | "sanity_unit_too_low"
    | "sanity_area_too_small"
    | "sanity_total_inconsistent"
    | "sanity_subtotal_too_low"
    | "qty_above_max"
    | "recalc_required"
    | "pricing_config_unavailable";
  expected?: number;
  actual?: number;
  hint?: string;
}

export interface ValidationResult {
  ok: boolean;
  failures: ValidationFailDetail[];
  /** Recalc başarılı olan item'lar — debug için */
  recalcedItemIds: string[];
}

export interface CartItemQuote {
  unit: number;
  total: number;
}

// ============================================================
// Constants
// ============================================================

/** Recalc tolerans — kur / rounding sapması için %2 */
const RECALC_TOLERANCE_PCT = 0.02;

/** Sanity floor: birim fiyat min */
const SANITY_UNIT_MIN_TL = 0.4;

/** Sanity floor: minimum etiket alanı (mm²) — 10×10 = 100 */
const SANITY_MIN_AREA_MM2 = 100;

/** Sanity floor: subtotal item başına min */
const SANITY_SUBTOTAL_PER_ITEM_MIN_TL = 1;

/** item.total ↔ unit×qty yuvarlama tolerans */
const TOTAL_UNIT_QTY_TOLERANCE_TL = 0.5;

// ============================================================
// formFactor inference — etiket için rulo/tabaka
// ============================================================

/**
 * Cart item'da formFactor ya meta.formFactor ya da config string içinde.
 * Sticker için her zaman "sticker". Belirlenemezse null → sanity floor'a düşülür.
 */
function inferEtiketFormFactor(
  item: CartItemForValidation
): "rulo" | "tabaka" | null {
  // 1) meta.formFactor
  const metaFF = item.meta?.["formFactor"];
  if (metaFF === "rulo" || metaFF === "tabaka") return metaFF;

  // 2) config string parse — "rulo etiket" veya "tabaka" geçiyor mu
  const cfg = (item.config || "").toLowerCase();
  if (cfg.includes("tabaka") || cfg.includes("sheet")) return "tabaka";
  if (cfg.includes("rulo") || cfg.includes("roll")) return "rulo";

  // 3) meta.config_scope (admin/test bazı durumlarda yazıyor)
  const scope = item.meta?.["scope"];
  if (scope === "etiket_rulo") return "rulo";
  if (scope === "etiket_tabaka") return "tabaka";

  return null;
}

// ============================================================
// Per-item validation
// ============================================================

interface RecalcOutcome {
  recalced: boolean;
  failure?: ValidationFailDetail;
}

async function computeStickerQuote(
  item: CartItemForValidation,
  config: ProfileConfig
): Promise<CartItemQuote | null> {
  if (!item.material || !item.finish) {
    return null;
  }

  const designCount = resolveDesignCount(item);
  const tierQty = perDesignQty(item.qty, designCount);
  if (tierQty * designCount !== item.qty) {
    return null;
  }

  const pageMode = item.meta?.["pageMode"] === true;
  const result = quoteStickerFromConfig(config, {
    width: item.width,
    height: item.height,
    qty: tierQty,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cut: (item.cut ?? "diecut") as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material: item.material as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    finish: item.finish as any,
    pageMode,
  });
  if (!result || !result.ok) return null;

  return expectedCartLineFromPerDesignQuote(
    result.unitPrice,
    item.qty,
    designCount
  );
}

async function recalcSticker(
  item: CartItemForValidation,
  config: ProfileConfig
): Promise<RecalcOutcome> {
  const designCount = resolveDesignCount(item);
  const tierQty = perDesignQty(item.qty, designCount);
  if (tierQty * designCount !== item.qty) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "sanity_total_inconsistent",
        hint: `Sticker qty ${item.qty} designCount ${designCount} ile uyumsuz`,
      },
    };
  }

  const expected = await computeStickerQuote(item, config);
  if (!expected) return { recalced: false };

  const expectedTotal = expected.total;
  const expectedUnit = expected.unit;
  const totalDiff = Math.abs(item.total - expectedTotal);
  const unitDiff = Math.abs(item.unit - expectedUnit);

  // Tolerans: max(0.5 TL, expected * %2)
  const totalTol = Math.max(0.5, expectedTotal * RECALC_TOLERANCE_PCT);
  const unitTol = Math.max(0.1, expectedUnit * RECALC_TOLERANCE_PCT);

  if (totalDiff > totalTol) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "recalc_total_mismatch",
        expected: Number(expectedTotal.toFixed(2)),
        actual: item.total,
        hint: `Sticker ${item.title}: client total ${item.total}, server recalc ${expectedTotal.toFixed(2)}`,
      },
    };
  }
  if (unitDiff > unitTol) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "recalc_unit_mismatch",
        expected: Number(expectedUnit.toFixed(4)),
        actual: item.unit,
      },
    };
  }
  return { recalced: true };
}

function parseCustomizationsFromMeta(
  meta: Record<string, unknown> | null | undefined
): string[] | undefined {
  const raw = meta?.customizations;
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  return ids.length > 0 ? ids : undefined;
}

async function computeEtiketQuote(
  item: CartItemForValidation,
  config: ProfileConfig,
  formFactor: "rulo" | "tabaka"
): Promise<CartItemQuote | null> {
  const materialId = item.materialId ?? item.material;
  if (!materialId) return null;

  const designCount = resolveDesignCount(item);
  const tierQty = perDesignQty(item.qty, designCount);
  if (tierQty * designCount !== item.qty) {
    return null;
  }

  const metaCustomizations = parseCustomizationsFromMeta(item.meta);
  const customizationIds =
    metaCustomizations ??
    (item.customizationId ? [item.customizationId] : undefined);

  const result = quoteEtiketFromConfig(
    config,
    {
      width: item.width,
      height: item.height,
      qty: tierQty,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      material: materialId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coating: (item.coatingId ?? "") as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customization: (customizationIds?.[0] ?? "") as any,
      customizations: customizationIds as EtiketCustomId[] | undefined,
    },
    {
      formFactor,
      pricebookSnapshot: isPricebookMode(config)
        ? await fetchPricebookSnapshot()
        : undefined,
    }
  );
  if (!result || !result.ok) return null;

  return expectedCartLineFromPerDesignQuote(
    result.unitPrice,
    item.qty,
    designCount
  );
}

async function recalcEtiket(
  item: CartItemForValidation,
  config: ProfileConfig,
  formFactor: "rulo" | "tabaka"
): Promise<RecalcOutcome> {
  if (item.qty > PRICEBOOK_MAX_QTY) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "qty_above_max",
        expected: PRICEBOOK_MAX_QTY,
        actual: item.qty,
        hint: `Etiket qty ${item.qty} pricebook üst sınırı ${PRICEBOOK_MAX_QTY}`,
      },
    };
  }

  const designCount = resolveDesignCount(item);
  const tierQty = perDesignQty(item.qty, designCount);
  if (tierQty * designCount !== item.qty) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "sanity_total_inconsistent",
        hint: `Etiket qty ${item.qty} designCount ${designCount} ile uyumsuz`,
      },
    };
  }

  const expected = await computeEtiketQuote(item, config, formFactor);
  if (!expected) return { recalced: false };

  const expectedTotal = expected.total;
  const expectedUnit = expected.unit;
  const totalDiff = Math.abs(item.total - expectedTotal);
  const unitDiff = Math.abs(item.unit - expectedUnit);

  const totalTol = Math.max(0.5, expectedTotal * RECALC_TOLERANCE_PCT);
  const unitTol = Math.max(0.1, expectedUnit * RECALC_TOLERANCE_PCT);

  if (totalDiff > totalTol) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "recalc_total_mismatch",
        expected: Number(expectedTotal.toFixed(2)),
        actual: item.total,
        hint: `Etiket ${formFactor} ${item.title}: client ${item.total}, server ${expectedTotal.toFixed(2)}`,
      },
    };
  }
  if (unitDiff > unitTol) {
    return {
      recalced: true,
      failure: {
        itemId: item.id,
        reason: "recalc_unit_mismatch",
        expected: Number(expectedUnit.toFixed(4)),
        actual: item.unit,
      },
    };
  }
  return { recalced: true };
}

// ============================================================
// Sanity floor — recalc yapılamazsa
// ============================================================

function sanityCheckItem(
  item: CartItemForValidation
): ValidationFailDetail | null {
  // Unit fiyat alt limit
  if (item.unit < SANITY_UNIT_MIN_TL) {
    return {
      itemId: item.id,
      reason: "sanity_unit_too_low",
      expected: SANITY_UNIT_MIN_TL,
      actual: item.unit,
      hint: `Birim fiyat ${item.unit} TL minimum ${SANITY_UNIT_MIN_TL} TL altında`,
    };
  }

  // Alan
  const area = item.width * item.height;
  if (area < SANITY_MIN_AREA_MM2) {
    return {
      itemId: item.id,
      reason: "sanity_area_too_small",
      expected: SANITY_MIN_AREA_MM2,
      actual: area,
      hint: `${item.width}×${item.height} mm = ${area} mm² (min ${SANITY_MIN_AREA_MM2})`,
    };
  }

  // total ≈ unit × qty
  const computedTotal = item.unit * item.qty;
  if (Math.abs(item.total - computedTotal) > TOTAL_UNIT_QTY_TOLERANCE_TL) {
    return {
      itemId: item.id,
      reason: "sanity_total_inconsistent",
      expected: Number(computedTotal.toFixed(2)),
      actual: item.total,
      hint: `total ${item.total} ≠ unit ${item.unit} × qty ${item.qty} = ${computedTotal.toFixed(2)}`,
    };
  }

  return null;
}

// ============================================================
// Main API
// ============================================================

export async function validateCartPricing(
  items: CartItemForValidation[],
  subtotal: number
): Promise<ValidationResult> {
  const failures: ValidationFailDetail[] = [];
  const recalcedItemIds: string[] = [];

  // Subtotal alt limit kaldırıldı (PARA-FIX M1 — recalc tek otorite)

  // Scope başına config cache
  const configCache: Partial<
    Record<"sticker" | "etiket_rulo" | "etiket_tabaka", ProfileConfig>
  > = {};

  async function getCfg(
    scope: "sticker" | "etiket_rulo" | "etiket_tabaka"
  ): Promise<ProfileConfig | null> {
    if (configCache[scope]) return configCache[scope]!;
    try {
      const cfg = await getLivePricingConfig<ProfileConfig>(scope);
      configCache[scope] = cfg;
      return cfg;
    } catch (e) {
      if (e instanceof PricingConfigUnavailableError) {
        Sentry.captureMessage("pricing_config_unavailable", {
          level: "fatal",
          tags: { scope },
          extra: { scope, message: e.message },
        });
      } else {
        Sentry.captureException(e, { extra: { scope } });
      }
      console.error(`[payment-validation] config fetch failed for ${scope}`, e);
      return null;
    }
  }

  // Her item için recalc → fallback sanity
  for (const item of items) {
    // Her item için: önce recalc dene
    let recalcOutcome: RecalcOutcome = { recalced: false };

    if (item.product === "sticker") {
      const cfg = await getCfg("sticker");
      if (!cfg) {
        failures.push({
          itemId: item.id,
          reason: "pricing_config_unavailable",
          hint: "Fiyat şu an doğrulanamıyor, lütfen tekrar deneyin.",
        });
        continue;
      }
      recalcOutcome = await recalcSticker(item, cfg);
    } else if (item.product === "etiket") {
      const ff = inferEtiketFormFactor(item);
      if (ff) {
        const scope = ff === "rulo" ? "etiket_rulo" : "etiket_tabaka";
        const cfg = await getCfg(scope);
        if (!cfg) {
          failures.push({
            itemId: item.id,
            reason: "pricing_config_unavailable",
            hint: "Fiyat şu an doğrulanamıyor, lütfen tekrar deneyin.",
          });
          continue;
        }
        recalcOutcome = await recalcEtiket(item, cfg, ff);
      }
    }

    if (recalcOutcome.recalced) {
      recalcedItemIds.push(item.id);
      if (recalcOutcome.failure) failures.push(recalcOutcome.failure);
      continue;
    }

    // PARA-FIX M1: recalc başarısız → checkout RED (sanity floor bypass kapatıldı)
    failures.push({
      itemId: item.id,
      reason: "recalc_required",
      hint: "Fiyat yeniden hesaplanamadı. Sepeti yenileyip tekrar deneyin.",
    });
  }

  return {
    ok: failures.length === 0,
    failures,
    recalcedItemIds,
  };
}

/** Sepet reprice — checkout ile aynı quote motoru, tolerans yok */
export async function quoteCartItemPrice(
  item: CartItemForValidation
): Promise<CartItemQuote | null> {
  if (item.product === "sticker") {
    const cfg = await getLivePricingConfig<ProfileConfig>("sticker");
    return computeStickerQuote(item, cfg);
  }

  if (item.product === "etiket") {
    const ff = inferEtiketFormFactor(item);
    if (!ff) return null;
    const scope = ff === "rulo" ? "etiket_rulo" : "etiket_tabaka";
    const cfg = await getLivePricingConfig<ProfileConfig>(scope);
    return computeEtiketQuote(item, cfg, ff);
  }

  return null;
}
